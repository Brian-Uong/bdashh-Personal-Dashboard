import {apiFetch} from './api-client.mjs';
import {requireOwner} from './dashboard-access.mjs';
import {recordSchema} from './record-schema.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createEditor({getData,onSaved,pull}){
 let busy=false;
 const show=(html)=>{const d=document.createElement('dialog');d.className='record-editor';d.innerHTML=html;document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;};
 async function open(tab='Daily Planner',row=null,prefill={}){
 requireOwner();
 if(!recordSchema[tab])tab='Daily Planner';
 const latest=await pull();onSaved(latest);let selected=tab;
 const dialog=show('<form><div class="pd-panel-head"><h2 id="recordHeading"></h2><button type="button" id="recordCancel" class="quiet">Cancel</button></div><label>Record type<select id="recordType"></select></label><div id="recordFields"></div><p id="recordStatus" role="status" aria-live="polite">Saving updates your dashboard and workbook tab together.</p><button type="submit" class="button gold" id="recordSave">Save record</button></form>');
 const type=dialog.querySelector('#recordType');type.innerHTML=Object.entries(recordSchema).map(([key,d])=>`<option value="${esc(key)}">${esc(d.label)}</option>`).join('');type.value=tab;type.disabled=row!==null;
 let baseRow=null,headers=[],requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
 function fields(){selected=type.value;const def=recordSchema[selected];const rows=latest.sheets?.[selected];headers=rows?.[def.start-1]||def.headers;baseRow=row===null?null:structuredClone(rows[row]);
 dialog.querySelector('#recordHeading').textContent=(row===null?'Add ':'Edit ')+def.label.toLowerCase();
 const inputs=headers.map((h,i)=>{const label=String(h),long=/notes|draft|evidence|assessment|summary|message|personalisation|sources|limitations|steps|objective|preparation|helps/i.test(label);const kind=/^(date|deadline|last verified|checked)$/i.test(label)?'date':/^time$/i.test(label)?'time':/latitude|longitude/i.test(label)?'number':'text';const required=label===def.headers[def.required];let val=baseRow?.[i]??(selected===tab?prefill[label]:'')??'';if(row===null&&label==='Date'&&!(selected===tab&&Object.hasOwn(prefill,label)))val=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date());return `<label>${esc(label)}${required?' *':''}${long?`<textarea name="c${i}" rows="3" ${required?'required':''}>${esc(val)}</textarea>`:`<input name="c${i}" type="${kind}" step="any" value="${esc(val)}" ${required?'required':''}>`}</label>`});
 dialog.querySelector('#recordFields').innerHTML='<div class="record-fields">'+inputs.slice(0,10).join('')+'</div>'+(inputs.length>10?'<details><summary>Additional details</summary><div class="record-fields">'+inputs.slice(10).join('')+'</div></details>':'');
 const addressIndex=headers.findIndex(h=>['Location','Address','Office address'].includes(h));const latIndex=headers.indexOf('Latitude'),lngIndex=headers.indexOf('Longitude');
 if(addressIndex>=0&&latIndex>=0&&lngIndex>=0){
 const field=dialog.querySelector(`[name="c${addressIndex}"]`);const lookup=document.createElement('div');lookup.className='record-geocode';lookup.innerHTML='<button type="button" class="button subtle">Find address on map</button><p>Search uses OpenStreetMap data via Photon. Choose the correct result before saving.</p><div role="status"></div>';field.closest('label').after(lookup);
 const primary=dialog.querySelector('.record-fields');for(const i of [latIndex,lngIndex])primary.append(dialog.querySelector(`[name="c${i}"]`).closest('label'));
 lookup.querySelector('button').onclick=async()=>{const result=lookup.querySelector('[role=status]'),button=lookup.querySelector('button');button.disabled=true;result.textContent='Searching…';try{const r=await apiFetch('/api/places/search?'+new URLSearchParams({q:field.value}),{signal:AbortSignal.timeout(20000)}),data=await r.json();if(!r.ok)throw Error(data.error);result.innerHTML=data.results.length?data.results.map((x,i)=>`<button type="button" class="record-choice" data-address-result="${i}">${esc(x.address)}</button>`).join(''):'No matches. Try a full street address or enter coordinates below.';result.onclick=e=>{const b=e.target.closest('[data-address-result]');if(!b)return;const place=data.results[Number(b.dataset.addressResult)];field.value=place.address;dialog.querySelector(`[name="c${latIndex}"]`).value=place.coordinates[1];dialog.querySelector(`[name="c${lngIndex}"]`).value=place.coordinates[0];result.textContent='Location selected. Save the record to add its map pin.';};}catch(e){result.textContent=e.message||'Search unavailable. Enter coordinates below.';}finally{button.disabled=false;}};
 }

 }
 if(row!==null){
 const remove=document.createElement('button');remove.type='button';remove.className='button subtle';remove.textContent='Delete record';remove.style.cssText='border-color:#ff4f88;color:#ff9fbe;margin-left:12px';dialog.querySelector('#recordSave').after(remove);
 const deletionId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 remove.onclick=async()=>{if(busy)return;const label=baseRow?.[recordSchema[selected].required]||'this record';if(!confirm(`Delete “${label}” from your dashboard and workbook? You can undo it after deletion.`))return;busy=true;remove.disabled=true;dialog.querySelector('#recordSave').disabled=true;const status=dialog.querySelector('#recordStatus');status.textContent='Deleting…';
 try{const r=await apiFetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',tab:selected,row,baseRow,requestId:deletionId})});const data=await r.json();if(!r.ok)throw Error(data.error||'Delete failed');onSaved(data);dialog.querySelector('#recordFields').hidden=true;dialog.querySelector('#recordSave').hidden=true;remove.hidden=true;dialog.querySelector('#recordCancel').textContent='Close';status.textContent='Record deleted from your dashboard and workbook.';
 const undo=document.createElement('button');undo.type='button';undo.className='button gold';undo.textContent='Undo delete';status.after(undo);const restoreId=deletionId+'-restore';undo.onclick=async()=>{if(busy)return;busy=true;undo.disabled=true;try{const r=await apiFetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restore',tab:selected,deletionId,requestId:restoreId})});const data=await r.json();if(!r.ok)throw Error(data.error||'Restore failed');onSaved(data);dialog.close();}catch(e){status.textContent=e.message;}finally{busy=false;undo.disabled=false;}};
 }catch(e){status.textContent=e.message;remove.disabled=false;dialog.querySelector('#recordSave').disabled=false;}finally{busy=false;}};
 }
 type.onchange=fields;fields();dialog.querySelector('#recordCancel').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const button=dialog.querySelector('#recordSave'),status=dialog.querySelector('#recordStatus');button.disabled=true;button.textContent='Saving…';status.textContent='Saving your record…';
 const cells=headers.map((_,i)=>dialog.querySelector(`[name="c${i}"]`).value.trim());
 try{const r=await apiFetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tab:selected,row,baseRow,cells,requestId})});const data=await r.json();if(!r.ok)throw Error(data.error||'Save failed');onSaved(data);dialog.close();}catch(e){status.textContent=e.message+' Your entries are still here; you can retry.';}finally{busy=false;button.disabled=false;button.textContent='Save record';}};
 }
 async function manage(tab='Daily Planner'){
 requireOwner();
 if(!recordSchema[tab])tab='Daily Planner';const data=await pull();onSaved(data);
 const dialog=show('<div class="pd-panel-head"><h2>Edit records</h2><button class="quiet" id="manageClose">Close</button></div><label>Record type<select id="manageType"></select></label><label>Search<input id="manageSearch" type="search" placeholder="Find a record"></label><div id="recordList"></div>');
 const type=dialog.querySelector('#manageType');type.innerHTML=Object.entries(recordSchema).map(([k,d])=>`<option value="${esc(k)}">${esc(d.label)}</option>`).join('');type.value=tab;
 const render=()=>{const def=recordSchema[type.value],q=dialog.querySelector('#manageSearch').value.toLowerCase();const rows=(data.sheets?.[type.value]||[]).map((cells,row)=>({cells,row})).filter(r=>r.row>=def.start&&r.cells.some(c=>String(c).trim())&&r.cells.join(' ').toLowerCase().includes(q));dialog.querySelector('#recordList').innerHTML=rows.length?rows.map(r=>`<button class="record-choice" data-edit="${r.row}"><strong>${esc(r.cells[def.required]||'Record')}</strong><span>${esc(r.cells.slice(0,6).join(' · '))}</span></button>`).join(''):'<p>No records yet. Use Add record to get started.</p>';};type.onchange=render;dialog.querySelector('#manageSearch').oninput=render;render();dialog.querySelector('#manageClose').onclick=()=>dialog.close();dialog.querySelector('#recordList').onclick=e=>{const b=e.target.closest('[data-edit]');if(b){const t=type.value;dialog.close();open(t,Number(b.dataset.edit));}};
 }
 return {open,manage};
}
