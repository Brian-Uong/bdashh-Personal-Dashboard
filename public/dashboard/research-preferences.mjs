import {apiFetch} from './api-client.mjs';
import {canEdit} from './dashboard-access.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dialog=null;
const fields=[['roles','Target roles'],['locations','Preferred locations'],['industries','Industries of interest'],['experience','Your background'],['timing','Graduation and availability'],['connections','People to find'],['events','Events to find'],['exclusions','Exclude or flag']];
const flags=[['jobsEnabled','Find new jobs'],['peopleEnabled','Find people to connect with'],['eventsEnabled','Find local events'],['includeRemote','Include relevant remote jobs']];
export async function openResearchPreferences(){
 if(!canEdit)return;
 if(dialog?.open){dialog.focus();return;}
 const d=dialog=document.createElement('dialog');d.className='record-editor research-dialog';d.setAttribute('aria-labelledby','researchHeading');
 d.innerHTML='<div class="pd-panel-head"><div><span class="pd-kicker">CAREER SEARCH PREFERENCES</span><h2 id="researchHeading">Your career search preferences</h2></div><button type="button" data-close class="quiet">Close</button></div><p>Use <strong>Refresh jobs &amp; recruiters</strong> inside Career hub to check current public sources. The button matches role keywords and locations, including your remote preference. Your broader background, industries and availability also guide scheduled research. Direct public-source refresh requires no AI service. Owner tools also offers broader AI career research when your server is configured.</p><div data-last-run class="research-run" aria-live="polite">Loading research status…</div><form data-preferences hidden><h3>What should we look for?</h3><div class="research-toggles"></div><div class="record-fields research-fields"></div><p class="pd-note">Saved preferences apply to your next Career hub refresh and scheduled research. New leads appear in Career hub; events appear in Local events and the workbook. Searches do not send messages or submit applications.</p><button class="button gold" type="submit">Save preferences</button></form><p data-status role="status" aria-live="polite"></p>';
 document.body.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>{d.remove();if(dialog===d)dialog=null;});
 const form=d.querySelector('form'),status=d.querySelector('[data-status]');let revision=0;
 try{
  const r=await apiFetch('/api/research',{cache:'no-store'});if(!r.ok)throw Error('Could not load your preferences. Close this window and try again.');const data=await r.json();revision=data.revision;
  form.querySelector('.research-toggles').innerHTML=flags.map(([key,label])=>`<label><input type="checkbox" name="${key}" ${data.preferences[key]?'checked':''}>${label}</label>`).join('');
  form.querySelector('.research-fields').innerHTML=fields.map(([key,label])=>`<label>${label}<textarea name="${key}" rows="3" maxlength="1500" ${['roles','locations'].includes(key)?'required':''}>${esc(data.preferences[key])}</textarea></label>`).join('');
  const run=data.lastRun;d.querySelector('[data-last-run]').innerHTML=run?`<strong>${run.mode==='setup'?'Setup research check':'Last research run'} · ${esc(({completed:'Completed',partial:'Partially completed',failed:'Could not complete'})[run.status])}</strong><p>${esc(new Date(run.finishedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'}))} PT · ${run.counts.jobs} jobs · ${run.counts.people} people · ${run.counts.events} events</p><p>${esc(run.summary)}</p>${run.issues.length?'<ul>'+run.issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''}`:'<strong>Research schedule pending configuration</strong><p>No independent research result has been recorded here yet. Existing saved leads are still available in Career hub.</p>';
  form.hidden=false;
 }catch(e){status.textContent=e.message;d.querySelector('[data-last-run]').textContent='Research status unavailable.';}
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Saving your preferences…';try{
  const preferences=Object.fromEntries([...fields.map(([key])=>[key,form.elements[key].value]),...flags.map(([key])=>[key,form.elements[key].checked])]);
  const r=await apiFetch('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preferences',baseRevision:revision,preferences})});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not save preferences.');revision=data.revision;status.textContent='Saved. Your next Career hub refresh will use these preferences.';
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}};
}
