import {readFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {assertReleaseReady,collectSource,verifyAssets,writePacket,hash} from './release-files.mjs';
const root=path.resolve(import.meta.dirname,'..');
const status=JSON.parse(await readFile(path.join(root,'migration-status.json'),'utf8'));
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){const key=args[i];if(key==='--development')options.development=true;else if(['--wrangler','--site-version','--site-commit','--site-snapshot'].includes(key)&&args[i+1])options[key]=args[++i];else throw Error('Unsupported release option.');}
let source;
if(options.development){
 const workspace=JSON.parse(await readFile(path.join(root,'workspace-status.json'),'utf8'));
 const version=Number(options['--site-version']),commit=options['--site-commit'];
 if(!Number.isSafeInteger(version)||version<1||!/^[a-f0-9]{40}$/.test(commit||'')||workspace.hostedWorkspacePreview?.version!==version||workspace.originalSiteCommit!==commit)throw Error('Package must match the recorded published Site version and full commit.');
 source={version,commit};
}else source=assertReleaseReady(status); // Publication preparation still requires actual reconciliation/authorization.

const require=createRequire(import.meta.url);
const wrangler=options['--wrangler']??require.resolve('wrangler/bin/wrangler.js');
const output=path.join(root,'build-release',`v${source.version}-${source.commit.slice(0,12)}`);
const validation={schemaVersion:1,source,startedAt:new Date().toISOString(),nodeVersion:process.version,checks:[],notRun:['Browser visual testing','Live provider refreshes','Fresh GitHub/production source reconciliation','Production deployment smoke checks'],published:false};
function run(file,args=[]){
 const startedAt=new Date().toISOString();
 const r=spawnSync(process.execPath,[file,...args],{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 if(r.status!==0)throw Error('Release preparation failed; no publication was performed.');
 validation.checks.push({command:[path.relative(root,file),...args.map(arg=>arg.startsWith(root+path.sep)?path.relative(root,arg):arg)],startedAt,completedAt:new Date().toISOString(),exitCode:0});
}
run(path.join(root,'scripts/check-dashboard.mjs'));
run(path.join(root,'scripts/preflight.mjs'));
run(path.join(root,'scripts/prepare-assets.mjs'));
await mkdir(output,{recursive:true});
run(wrangler,['deploy','--dry-run','--outdir',path.join(output,'worker')]);
const manifest=(await import(pathToFileURL(path.join(root,'worker/assets-manifest.mjs')).href+'?release='+Date.now())).default;
const assets=await verifyAssets(root,manifest);
const files=await collectSource(root);
const worker=await readFile(path.join(output,'worker/index.js'));
validation.sourceFiles=files.length;
validation.assetFiles=assets.length;
validation.sourceFingerprint=hash(Buffer.from(files.map(file=>`${file.path}\0${file.sha256}`).join('\n')));
validation.assetAndSourceHashesVerified=true;
validation.completedAt=new Date().toISOString();
await writePacket(output,'validation',validation);
const config=JSON.parse(await readFile(path.join(root,'wrangler.json'),'utf8'));
const sourcePacket=await writePacket(output,'github-source',{format:'bdashh-standalone-source',schemaVersion:1,source,files});
const assetPacket=await writePacket(output,'assets',{release:manifest.release,files:assets});
const workerPacket=await writePacket(output,'worker',{entryPoint:'index.js',encoding:'base64',content:worker.toString('base64'),size:worker.length,sha256:hash(worker)});
const plan={preparationMode:options.development?'development_package':'approved_release',productionAuthorizationChanged:false,format:'bdashh-release-plan',schemaVersion:1,state:'prepared_not_published',source,repository:'Brian-Uong/bdashh-private',branch:'main',worker:config.name,accountId:config.account_id,assetBucket:'bdashh-private-assets',dataBucket:'bdashh-private-data',assetRelease:manifest.release,files:files.length,assets:assets.length,packets:{source:sourcePacket,assets:assetPacket,worker:workerPacket},preserve:{secretBindings:true,siteSettings:true,savedData:true},verificationRequired:['private GitHub repository and current branch head','remote source file hashes','immutable asset sizes and hashes','current owner settings unchanged','Worker deployment readback','anonymous and owner-route smoke checks'],published:false};
await writePacket(output,'release-plan',plan);
if(options['--site-snapshot']){
 const snapshot=JSON.parse(await readFile(path.resolve(options['--site-snapshot']),'utf8'));
 if(snapshot.source?.version!==source.version||snapshot.source?.commit!==source.commit)throw Error('Site snapshot does not match this package.');
 await writePacket(output,'source-snapshot',snapshot);
}
run(path.join(root,'scripts/package-release-zip.mjs'),['--directory',output]);
console.log(JSON.stringify({output,plan:'release-plan.json',version:source.version,assetRelease:manifest.release,files:files.length,assets:assets.length,published:false}));

