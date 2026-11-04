// Package an already-checked release. No network, upload, deploy or settings writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sourcePathAllowed,hash} from './release-files.mjs';
if(process.argv[2]!=='--directory'||!process.argv[3]||process.argv.length!==4)throw Error('Use --directory PATH');
const directory=path.resolve(process.argv[3]);
const read=name=>readFile(path.join(directory,name+'.json'),'utf8').then(JSON.parse);
const [plan,source,assets,worker]=await Promise.all(['release-plan','github-source','assets','worker'].map(read));
const validation=await read('validation');
if(validation.source?.version!==plan.source.version||validation.source?.commit!==plan.source.commit||validation.sourceFingerprint!==hash(Buffer.from(source.files.map(file=>`${file.path}\0${file.sha256}`).join('\n'))))throw Error('Validation does not match packaged source');
const entries=[];
const add=(name,bytes)=>entries.push({name,bytes,sha256:hash(bytes),size:bytes.length});
for(const file of source.files){
 if(!sourcePathAllowed(file.path))throw Error('Unsupported source path');
 const bytes=Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8');
 if(hash(bytes)!==file.sha256)throw Error('Source checksum mismatch: '+file.path);
 add('standalone/'+file.path,bytes);
}
let snapshot;
try{snapshot=await read('source-snapshot');}catch(error){if(error.code!=='ENOENT')throw error;}
if(snapshot){
 if(snapshot.source.version!==plan.source.version||snapshot.source.commit!==plan.source.commit)throw Error('Snapshot provenance mismatch');
 for(const file of snapshot.files){
  if(!sourcePathAllowed(file.path))throw Error('Unsupported Site source path');
  const bytes=Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8');
  if(hash(bytes)!==file.sha256)throw Error('Site checksum mismatch: '+file.path);
  add('site-source/'+file.path,bytes);
 }
 add('site-source/source-release.json',Buffer.from(JSON.stringify(snapshot.source,null,2)+'\n'));
}
const workerBytes=Buffer.from(worker.content,'base64');
if(hash(workerBytes)!==worker.sha256)throw Error('Worker checksum mismatch');
add('deploy/worker/index.js',workerBytes);
for(const file of assets.files){
 const relative=file.path.replace(/^\//,'');
 if(!sourcePathAllowed('public/'+relative))throw Error('Unsupported asset path');
 const bytes=Buffer.from(file.content,'base64');
 if(hash(bytes)!==file.sha256||bytes.length!==file.size)throw Error('Asset checksum mismatch: '+file.path);
 add('deploy/assets/'+relative,bytes);
}
for(const name of ['github-source','assets','worker','release-plan'])add('packets/'+name+'.json',await readFile(path.join(directory,name+'.json')));
add('VALIDATION.json',await readFile(path.join(directory,'validation.json')));
const readme=`# Brian's Dash release package — Site v${plan.source.version}

Published Site commit: ${plan.source.commit}
Static asset release: ${plan.assetRelease}
State: prepared and checked; this package has not deployed bdashh.com.

Contents:
- standalone/: complete independent website/GitHub source, including real owner controls, authentication and AI gates.
- site-source/: exact published development Site snapshot and its provenance, when supplied.
- deploy/: compiled Worker and verified immutable static assets.
- packets/: machine-readable source, asset, Worker and release-plan packets for the connected publishing tools.
- CHECKSUMS.json: SHA-256 and size of every payload file.
- VALIDATION.json: checks completed for this exact source, timestamps and checks still required at deployment.

For the next requested website release, read standalone/docs/RELEASE-WORKFLOW.md.
Compare fresh GitHub and deployed source before merging. Preserve production secrets,
site-settings.json and saved data. Confirm the version Brian requests, then record
actual reconciliation and authorization before release:check/release:prepare.
Upload and verify immutable assets before deploying their matching Worker, sync the
standalone source to GitHub, then read back the deployment and remote hashes.
Never replace the standalone runtime with the Sites-only source tree.

To make the next development package after updating workspace-status.json:
npm run release:package -- --site-version NUMBER --site-commit FULL_SHA --site-snapshot PATH

Packaging reruns checks, verifies source/assets, and performs a Worker dry run. It
does not publish, alter runtime data, or switch on AI. Existing production choices
remain authoritative. Browser and paid-provider checks must be recorded separately;
a successful package does not claim those checks were performed.
`;
add('README.md',Buffer.from(readme));
const manifest={format:'bdashh-clean-release',schemaVersion:1,source:plan.source,assetRelease:plan.assetRelease,preparedAt:new Date().toISOString(),preparationMode:plan.preparationMode,published:false,files:entries.map(({name,size,sha256})=>({path:name,size,sha256}))};
add('CHECKSUMS.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
const bundle=path.join(directory,'bundle');await mkdir(bundle,{recursive:true});
for(const {name,bytes} of entries){const target=path.join(bundle,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
const archive=path.join(directory,`Brians-Dash-v${plan.source.version}-release.zip`);
const python=process.env.CODEX_PRIMARY_RUNTIME_PYTHON||(process.platform==='win32'?'python':'python3');
const result=spawnSync(python,['-c',`import hashlib,json,pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1]); dest=pathlib.Path(sys.argv[2]); manifest=json.loads((root/'CHECKSUMS.json').read_text())
names=[f['path'] for f in manifest['files']]+['CHECKSUMS.json']
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
 for name in names:z.write(root/name,name)
with zipfile.ZipFile(dest) as z:
 assert z.testzip() is None
 for f in manifest['files']:
  data=z.read(f['path']); assert len(data)==f['size'] and hashlib.sha256(data).hexdigest()==f['sha256'],f['path']
print(json.dumps({'archive':str(dest),'verifiedFiles':len(names),'bytes':dest.stat().st_size}))
`,bundle,archive],{encoding:'utf8'});
if(result.status!==0)throw Error('ZIP creation/readback failed: '+result.stderr);
console.log(result.stdout.trim());
