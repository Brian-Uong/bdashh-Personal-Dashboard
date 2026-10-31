// Run from the cloud checkout that already contains the published Site source.
// This prepares a private GitHub handoff. It performs no network calls or deployment.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {collectSource,writePacket} from './release-files.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--source','--version','--commit','--output'].includes(args[i])||!args[i+1])throw Error('Use --source PATH --version NUMBER --commit FULL_SHA [--output PATH]');options[args[i]]=args[i+1];}
const root=path.resolve(options['--source']??'.');
const version=Number(options['--version']),expected=options['--commit'];
if(!Number.isSafeInteger(version)||version<1||!/^[a-f0-9]{40}$/.test(expected??''))throw Error('Pass the exact published Site version and commit returned by Sites.');
function git(args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',maxBuffer:20_000_000});if(r.status!==0)throw Error('Could not read the source checkout with Git.');return r.stdout;}
const head=git(['rev-parse','HEAD']).trim();
if(head!==expected)throw Error('Source checkout does not match the published Site commit.');
if(git(['status','--porcelain','--untracked-files=no']).trim())throw Error('Tracked source has uncommitted changes. Publish or commit the intended version before mirroring.');
const hosting=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));
if(hosting.project_id!=='appgprj_6ae23020eb70819199a6dbf59b793ff9')throw Error('This is not Brian\'s Dash. Do not export the separate business project.');
const files=await collectSource(root,git(['ls-files','-z']).split('\0').filter(Boolean));
for(const name of ['public/dashboard/index.html','.openai/hosting.json','package.json'])if(!files.some(x=>x.path===name))throw Error('Incomplete source export: '+name);
const source={projectId:hosting.project_id,version,commit:head,gitTree:git(['rev-parse','HEAD^{tree}']).trim(),capturedAt:new Date().toISOString()};
const output=path.resolve(options['--output']??path.join(root,'build-source-handoff',head));
const packet=await writePacket(output,'source-snapshot',{format:'bdashh-source-snapshot',schemaVersion:1,source,files});
console.log(JSON.stringify({source,files:files.length,output,packet,githubBranch:'site-source',uploaded:false}));
