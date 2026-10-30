import {apiFetch} from './api-client.mjs';
let owner=false;
try {
  const response=await apiFetch('/api/access',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(response.ok)owner=(await response.json()).canEdit===true;
} catch { /* A failed permission check always falls back to read-only. */ }
export const canEdit=owner;
document.body.dataset.owner=String(owner);
const label=document.getElementById('accessLabel');
if(label)label.textContent=owner?'OWNER VIEW':'READ ONLY';
const signIn=document.getElementById('ownerSignIn');
if(signIn)signIn.hidden=owner;

export function requireOwner(){
  if(!canEdit)throw Error('This dashboard is read-only. Only the owner can make changes.');
}

const tools=document.getElementById('ownerTools');
if(tools){
  document.addEventListener('click',event=>{if(!tools.contains(event.target))tools.open=false;});
  tools.addEventListener('keydown',event=>{if(event.key==='Escape'){tools.open=false;tools.querySelector('summary').focus();}});
  tools.addEventListener('click',event=>{if(event.target.closest('button'))tools.open=false;});
}
