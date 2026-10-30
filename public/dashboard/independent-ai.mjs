import {canEdit} from './dashboard-access.mjs';
if(canEdit){
  const panel=document.querySelector('.owner-tools-panel');
  if(panel){
    const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    for(const [kind,label] of [['briefing','Refresh news briefing'],['career','AI career research']]){
      const button=document.createElement('button');button.className='button subtle';button.textContent=label;
      button.addEventListener('click',event=>event.stopPropagation());
      button.onclick=async()=>{
        button.disabled=true;status.textContent='Researching current sources. This may take a few minutes.';
        try{
          const r=await fetch('/api/ai/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(200000)});
          const data=await r.json();if(!r.ok)throw Error(data.error||'Research could not finish.');
          status.textContent='Saved. Reloading your dashboard.';location.reload();
        }catch(e){status.textContent=e.name==='TimeoutError'?'The request timed out. It may still be running; reload saved data before trying again.':e.message;}
        finally{button.disabled=false;}
      };
      panel.append(button);
    }
    panel.append(status);
  }
}
