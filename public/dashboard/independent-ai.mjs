import {canEdit} from './dashboard-access.mjs';
import {apiFetch} from './api-client.mjs';
if(canEdit){
 const panel=document.querySelector('.owner-tools-panel');
 if(panel){
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const buttons=[];let busy=false;
  for(const [kind,label] of [['briefing','AI portfolio briefing'],['career','AI career research'],['news','AI news research']]){
   const button=document.createElement('button');button.className='button subtle';button.textContent=label;button.disabled=true;
   button.addEventListener('click',async event=>{
    event.stopPropagation();if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);
    status.textContent='Researching current sources. This may take a few minutes. Each attempt uses API credits.';
    try{
     const r=await apiFetch('/api/ai/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',timeoutMs:200000});
     const data=await r.json();if(!r.ok)throw Error(data.error||'Research could not finish.');
     status.textContent=data.status==='partial'?'Some sources could not be completed. Saved results are ready; use Refresh saved data or Reload articles to view them.':'Research saved. Use Refresh saved data or Reload articles to view the results.';
    }catch(error){status.textContent=error.message;}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);}
   });
   buttons.push(button);panel.append(button);
  }
  panel.append(status);
  try{
   const r=await apiFetch('/api/ai/status');if(!r.ok)throw Error('AI connection status could not load. Reload the dashboard to try again.');
   const info=await r.json();buttons.forEach(b=>b.disabled=!info.configured);
   status.textContent=info.configured?`On-demand research uses API credits. Daily attempt limits apply, including failures.`:info.onDemandReason||'AI is off on this dashboard. Enable it in Website controls when you are ready.';
  }catch(error){status.textContent=error.message;}
 }
}
