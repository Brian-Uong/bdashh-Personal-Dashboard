import {apiFetch} from './api-client.mjs';
import {requireOwner} from './dashboard-access.mjs';
import {collectBrowserPreferences,validateBrowserBackup} from './migration-data.mjs';
const status=(message,error=false)=>{const el=document.getElementById('feedback');el.textContent=message;el.className=error?'error':'success';};
const backupButton=document.getElementById('migrationBackupBtn');
backupButton.addEventListener('click',async()=>{
 try{
  requireOwner();backupButton.disabled=true;status('Preparing your saved data and browser preferences…');
  const paths={dashboard:'/api/sync',discovery:'/api/discovery',research:'/api/research',portfolioHistory:'/api/portfolio/history',news:'/api/news'};
  const data=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>{
   const response=await apiFetch(path);const value=await response.json();if(!response.ok)throw Error(value.error||`Could not back up ${key}.`);return [key,value];
  })));
  const backup={format:'brians-dash-migration',version:1,exportedAt:new Date().toISOString(),sourceOrigin:location.origin,data,browserPreferences:collectBrowserPreferences(localStorage)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`Brians-Dash-Backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  status('Backup downloaded. It contains personal records and browser preferences; keep it private and out of GitHub.');
 }catch(error){status(error.message,true);}finally{backupButton.disabled=false;}
});
const file=document.getElementById('restoreBrowserFile');
document.getElementById('restoreBrowserBtn').onclick=()=>{try{requireOwner();file.click();}catch(error){status(error.message,true);}};
file.onchange=async()=>{
 try{
  requireOwner();const selected=file.files[0];if(!selected)return;if(selected.size>20000000)throw Error('Choose a backup smaller than 20 MB.');
  const values=validateBrowserBackup(JSON.parse(await selected.text()));
  if(!Object.keys(values).length){status('No browser preferences were stored in this backup.');return;}
  if(!confirm('Restore the matching bookmarks, map settings and display preferences in this browser? Server records will not change.'))return;
  const before=collectBrowserPreferences(localStorage);
  try{for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);}
  catch(error){for(const key of Object.keys(values)){try{if(Object.hasOwn(before,key))localStorage.setItem(key,before[key]);else localStorage.removeItem(key);}catch{}}throw Error('Browser storage could not restore all preferences. Your previous settings were restored where possible.');}
  status('Browser preferences restored. Save any open drafts, then reload this page to apply them. Server records were not changed.');
 }catch(error){status(error.message||'Could not read this backup.',true);}finally{file.value='';}
};
