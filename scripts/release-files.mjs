import {readdir,readFile,lstat,realpath,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const sourceRoots=new Set(['app','components','db','docs','drizzle','examples','hooks','legacy','lib','public','scripts','tests','vendor','worker']);
const rootFiles=new Set(['AGENTS.md','README.md','VERIFICATION.md','THIRD-PARTY-NOTICES.md','LICENSE','NOTICE','package.json','package-lock.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.build.json','vite.config.ts','vite.config.mjs','next.config.ts','next.config.mjs','next-env.d.ts','eslint.config.mjs','eslint.config.js','postcss.config.mjs','postcss.config.js','tailwind.config.ts','tailwind.config.js','components.json','drizzle.config.ts','cloudflare-env.d.ts','migration-status.json','workspace-status.json','wrangler.json','wrangler.jsonc','wrangler.redirect.json','.gitignore','.gitattributes','.openai/hosting.json']);
const forbiddenParts=/^(?:node_modules|private-data|coverage|dist|build(?:-.*)?|\.git|\.wrangler|\.sites-runtime|\.next|migration-audit)$/;
export function sourcePathAllowed(name){
  if(typeof name!=='string'||name.includes('\\')||name.startsWith('/')||name.includes('\0'))return false;
  const parts=name.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||forbiddenParts.test(p)||/^\.env(?:\.|$)|^\.dev\.vars|\.(?:pem|key|zip|log)$/i.test(p)))return false;
  if(parts.at(-1)==='site-settings.json'||name==='wrangler.local.json')return false;
  if(rootFiles.has(name))return true;
  return sourceRoots.has(parts[0])&&!parts.some(p=>p.startsWith('.'));
}
export const hash=(bytes,kind='sha256')=>createHash(kind).update(bytes).digest('hex');
export function gitBlobSha(bytes){return hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes]),'sha1');}
export function scanSource(bytes,name){
  let text=bytes.toString('utf8');
  if(name==='tests/site-settings.test.mjs'){
    const testVariable='OPENAI_API_'+'KEY';
    text=text.replace(testVariable+":'never-expose-this-test-key'",testVariable+":'test'");
  }
  const patterns=[/sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/(?:OPENAI_API_KEY|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN)\s*[=:]\s*["'][A-Za-z0-9_-]{20,}/i];
  if(patterns.some(pattern=>pattern.test(text)))throw Error(`Possible credential in ${name}. Inspect locally; do not upload.`);
}
async function walk(root,relative=''){
  const files=[];
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
    const name=relative?relative+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink()){
      if(sourcePathAllowed(name)||sourceRoots.has(name))throw Error(`Source symlink is not allowed: ${name}`);
      continue;
    }
    if(entry.isDirectory()){
      if((!relative&&(sourceRoots.has(name)||name==='.openai'))||(relative&&!forbiddenParts.test(entry.name)&&!entry.name.startsWith('.')))files.push(...await walk(root,name));
    }else if(sourcePathAllowed(name))files.push(name);
  }
  return files.sort();
}
async function readConfined(root,name){
  const resolvedRoot=await realpath(root);
  const resolved=await realpath(path.join(root,name));
  const relative=path.relative(resolvedRoot,resolved);
  if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw Error('Source path escapes checkout');
  let current=root;
  for(const part of name.split('/')){current=path.join(current,part);if((await lstat(current)).isSymbolicLink())throw Error(`Source symlink is not allowed: ${name}`);}
  const stat=await lstat(resolved);
  if(!stat.isFile()||stat.size>10_000_000)throw Error(`Unsupported source file: ${name}`);
  return readFile(resolved);
}
export async function collectSource(root,trackedPaths){
  const names=(trackedPaths??await walk(root)).filter(sourcePathAllowed).sort();
  const files=[];
  for(const name of names){
    const bytes=await readConfined(root,name);scanSource(bytes,name);
    let content,encoding;
    try{content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);encoding='utf-8';}
    catch{content=bytes.toString('base64');encoding='base64';}
    files.push({path:name,mode:'100644',type:'blob',encoding,content,size:bytes.length,sha:gitBlobSha(bytes),sha256:hash(bytes)});
  }
  return files;
}
export function compareFiles(files,remoteTree){
  if(remoteTree.truncated)throw Error('Remote tree is truncated; do not publish an incomplete comparison.');
  const remote=new Map(remoteTree.tree.filter(x=>x.type==='blob').map(x=>[x.path,x]));
  const local=new Map(files.map(x=>[x.path,x]));
  return {
    changed:files.filter(x=>remote.get(x.path)?.sha!==x.sha),
    removed:[...remote.keys()].filter(name=>sourcePathAllowed(name)&&!local.has(name)),
    unchanged:files.filter(x=>remote.get(x.path)?.sha===x.sha).length
  };
}
export function assertReleaseReady(status){
  const approved=status.release_policy;
  if(!approved||!Number.isSafeInteger(approved.approved_source_version)||!/^[a-f0-9]{40}$/.test(approved.approved_source_commit??''))throw Error('Missing approved source provenance.');
  if(!status.source_reconciled||status.reconciled_source_commit!==approved.approved_source_commit)throw Error('Standalone source has not been reconciled with the approved release.');
  const requested=status.requested_release;
  if(requested&&(!requested.authorized||requested.source_version!==approved.approved_source_version||requested.source_commit!==approved.approved_source_commit||requested.source_retrieved!==true||requested.standalone_adaptation_completed!==true))throw Error(`Requested v${requested.source_version}; standalone checkout is v${approved.approved_source_version}. Retrieve and reconcile the exact requested source before release.`);
  if(approved.sync_github_on_every_publication!==true)throw Error('GitHub synchronization must be part of the publication policy.');
  return {version:approved.approved_source_version,commit:approved.approved_source_commit};
}
export async function verifyAssets(root,manifest){
  const assets=[];
  for(const [name,entry] of Object.entries(manifest.files)){
    const relative=name.replace(/^\//,'');
    if(!name.startsWith('/')||!sourcePathAllowed('public/'+relative)||entry.key!==`releases/${manifest.release}${name}`)throw Error('Invalid asset manifest path');
    const bytes=await readConfined(root,'public/'+relative);
    if(hash(bytes)!==entry.sha256||bytes.length!==entry.size)throw Error(`Asset checksum mismatch: ${name}`);
    assets.push({...entry,content:bytes.toString('base64'),encoding:'base64'});
  }
  const actual=[];
  async function publicFiles(relative=''){
    for(const entry of await readdir(path.join(root,'public',relative),{withFileTypes:true})){
      const name=relative?relative+'/'+entry.name:entry.name;
      if(entry.isSymbolicLink()||entry.name.startsWith('.'))throw Error('Unsupported public asset: '+name);
      if(entry.isDirectory())await publicFiles(name);
      else if(entry.isFile())actual.push('/'+name);
      else throw Error('Unsupported public asset: '+name);
    }
  }
  await publicFiles();
  if(actual.length!==assets.length||actual.some(name=>!Object.hasOwn(manifest.files,name)))throw Error('Public files differ from the asset manifest; regenerate and verify the release.');
  return assets;
}
export async function writePacket(directory,name,value){
  await mkdir(directory,{recursive:true});
  // ASCII JSON avoids Windows console encoding altering non-ASCII source text.
  const serialized=JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  await writeFile(path.join(directory,name+'.json'),serialized,'ascii');
  const chunks=[];
  for(let start=0;start<serialized.length;start+=48000){const chunk=`${name}-${String(chunks.length).padStart(3,'0')}.jsonpart`;await writeFile(path.join(directory,chunk),serialized.slice(start,start+48000),'ascii');chunks.push(chunk);}
  return {file:name+'.json',sha256:hash(Buffer.from(serialized)),chunks};
}

