import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const ignored=new Set(['node_modules','.git','.wrangler','build','private-data']);
export async function sourceHashes(directory){
 const hashes={};
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  if(ignored.has(e.name)||/^\.env|^\.dev\.vars/.test(e.name)||/\.(zip|log)$/.test(e.name)||e.isSymbolicLink())continue;
  const file=path.join(dir,e.name);
  if(e.isDirectory())await walk(file);
  else if(e.isFile())hashes[path.relative(directory,file).split(path.sep).join('/')]=createHash('sha256').update(await readFile(file)).digest('hex');
 }}
 await walk(directory);return hashes;
}
export function compareSource(base,local,online){
 const result={conflicts:[],upstreamChanges:[],workspaceChanges:[]};
 for(const file of [...new Set([...Object.keys(base),...Object.keys(local),...Object.keys(online)])].sort()){
  const b=base[file]??null,l=local[file]??null,o=online[file]??null;
  if(l===o)continue;
  if(o!==b){if(l!==b)result.conflicts.push(file);else result.upstreamChanges.push(file);}
  else if(l!==b)result.workspaceChanges.push(file);
 }
 return {...result,ready:!result.conflicts.length&&!result.upstreamChanges.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const incoming=process.argv[2];
 if(!incoming){console.error('Pass the latest complete online source directory. This check never writes either tree.');process.exitCode=1;}
 else{
  const baseline=JSON.parse(await readFile(path.join(root,'docs/online-source-baseline.json'),'utf8'));
  const [local,online]=await Promise.all([sourceHashes(root),sourceHashes(path.resolve(incoming))]);
  const result=compareSource(baseline.files,local,online);console.log(JSON.stringify(result,null,2));
  if(!result.ready)process.exitCode=1;
 }
}
