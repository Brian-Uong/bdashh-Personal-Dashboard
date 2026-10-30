// Run only against Brian's existing Site. Does not modify it or export secrets.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin='https://brians-dash-uong.astralduck36.chatgpt.site';
const output=new URL('../private-data/',import.meta.url);await mkdir(output,{recursive:true});
const files=[['dashboard.json','sync'],['discovery.json','discovery'],['research.json','research'],['portfolio-history-v1.json','portfolio/history']];
const manifest={source:origin,exportedAt:new Date().toISOString(),files:[]};
for(const [name,route] of files){
  const response=await fetch(origin+'/api/'+route,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Export failed for '+name+' (HTTP '+response.status+'). No migration completed.');
  const value=await response.json();if(!value||typeof value!=='object'||value.error)throw Error('Invalid export: '+name);
  const bytes=JSON.stringify(value,null,2);await writeFile(new URL(name,output),bytes);
  manifest.files.push({name,sha256:createHash('sha256').update(bytes).digest('hex')});console.log('Exported '+name);
}
await writeFile(new URL('export-manifest.json',output),JSON.stringify(manifest,null,2));
console.log('Server-data export complete. Browser-only preferences require a separate transfer.');
