import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sourcePathAllowed,collectSource,compareFiles,assertReleaseReady,verifyAssets,writePacket,gitBlobSha,hash} from '../scripts/release-files.mjs';

async function fixture(t){
  const base=path.resolve(tmpdir()),root=await mkdtemp(path.join(base,'bdashh-release-test-'));
  t.after(async()=>{if(path.dirname(path.resolve(root))!==base||!path.basename(root).startsWith('bdashh-release-test-'))throw Error('Unexpected test cleanup path');await rm(root,{recursive:true,force:true});});
  return root;
}
async function put(root,name,value){const file=path.join(root,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,value);}
const commit='a'.repeat(40),project='appgprj_6ae23020eb70819199a6dbf59b793ff9';
function status(){return {source_reconciled:true,reconciled_source_commit:commit,release_policy:{approved_source_version:65,approved_source_commit:commit,sync_github_on_every_publication:true},requested_release:{authorized:true,source_version:65,source_commit:commit,source_retrieved:true,standalone_adaptation_completed:true}};}

test('release guard rejects the known v65 request against v57 and incomplete adaptations',()=>{
  assert.equal(assertReleaseReady(status()).version,65);
  const old=status();old.release_policy.approved_source_version=57;assert.throws(()=>assertReleaseReady(old),/Requested v65/);
  for(const field of ['authorized','source_retrieved','standalone_adaptation_completed']){const value=status();value.requested_release[field]=false;assert.throws(()=>assertReleaseReady(value));}
  const wrong=status();wrong.reconciled_source_commit='b'.repeat(40);assert.throws(()=>assertReleaseReady(wrong),/reconciled/);
});

test('source packet excludes data, credentials, generated output and traversal paths',async t=>{
  const root=await fixture(t);
  for(const name of ['README.md','public/dashboard/index.html','lib/api.mjs','private-data/dashboard.json','.env','lib/.env.local','build-release/worker.js','public/site-settings.json','public/private-data/holdings.json'])await put(root,name,'example');
  const files=await collectSource(root);
  assert.deepEqual(files.map(x=>x.path),['README.md','lib/api.mjs','public/dashboard/index.html']);
  for(const name of ['/etc/passwd','public/../.env','public\\secret','worker/key.pem','app/node_modules/key.js'])assert.equal(sourcePathAllowed(name),false);
});

test('UTF-8 and binary packets preserve exact Git blob bytes through ASCII transfer chunks',async t=>{
  const root=await fixture(t),bytes=Buffer.from('\ufeffSign in ・ Access\r\nNeon → District');
  await put(root,'README.md',bytes);await put(root,'public/icon.bin',Buffer.from([0,255,254,1]));
  const files=await collectSource(root);
  assert.equal(files[0].sha,gitBlobSha(bytes));assert.equal(files[1].encoding,'base64');
  const output=path.join(root,'packet'),packet=await writePacket(output,'files',{files});
  const joined=(await Promise.all(packet.chunks.map(name=>readFile(path.join(output,name),'ascii')))).join('');
  assert.equal(hash(Buffer.from(joined)),packet.sha256);assert.doesNotMatch(joined,/[^\x00-\x7f]/);
  const decoded=JSON.parse(joined).files;
  for(const file of decoded){const content=Buffer.from(file.content,file.encoding==='base64'?'base64':'utf8');assert.equal(gitBlobSha(content),file.sha);}
});

test('credential scan fails without including the secret in its error',async t=>{
  const root=await fixture(t),secret='sk-'+'x'.repeat(32);await put(root,'lib/api.mjs',secret);
  await assert.rejects(collectSource(root),error=>error.message.includes('lib/api.mjs')&&!error.message.includes(secret));
});

test('GitHub delta uploads only changed files and never removes unmanaged workflows',()=>{
  const files=[{path:'README.md',sha:'one'},{path:'lib/new.mjs',sha:'two'}];
  const tree={truncated:false,tree:[{type:'blob',path:'README.md',sha:'one'},{type:'blob',path:'lib/old.mjs',sha:'old'},{type:'blob',path:'.github/workflows/check.yml',sha:'workflow'}]};
  const delta=compareFiles(files,tree);assert.equal(delta.unchanged,1);assert.deepEqual(delta.changed.map(x=>x.path),['lib/new.mjs']);assert.deepEqual(delta.removed,['lib/old.mjs']);
  assert.throws(()=>compareFiles(files,{...tree,truncated:true}),/truncated/);
});

test('asset verification rejects byte changes and unlisted public files',async t=>{
  const root=await fixture(t),bytes=Buffer.from('dashboard');await put(root,'public/dashboard/index.html',bytes);
  const manifest={release:'test',files:{'/dashboard/index.html':{key:'releases/test/dashboard/index.html',size:bytes.length,sha256:hash(bytes)}}};
  assert.equal((await verifyAssets(root,manifest)).length,1);
  await put(root,'public/extra.txt','unexpected');await assert.rejects(verifyAssets(root,manifest),/differ/);
  await put(root,'public/dashboard/index.html','changed');await assert.rejects(verifyAssets(root,manifest),/checksum/);
});

test('source export requires exact published commit, clean tracked source and correct Site identity',async t=>{
  const root=await fixture(t),repo=path.join(root,'site');await mkdir(repo);
  function git(args){const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
  git(['init','--initial-branch=main']);await put(repo,'.openai/hosting.json',JSON.stringify({project_id:project}));await put(repo,'public/dashboard/index.html','version');await put(repo,'package.json','{}');await put(repo,'.env','excluded fixture');git(['add','.']);git(['-c','user.name=Release test','-c','user.email=test@localhost','commit','-m','Source fixture']);
  const sha=git(['rev-parse','HEAD']);
  const script=path.resolve(import.meta.dirname,'../scripts/export-source-snapshot.mjs');
  const run=(expected=sha)=>spawnSync(process.execPath,[script,'--source',repo,'--version','65','--commit',expected,'--output',path.join(root,'export')],{encoding:'utf8'});
  const success=run();assert.equal(success.status,0,success.stderr);
  const snapshot=JSON.parse(await readFile(path.join(root,'export/source-snapshot.json'),'ascii'));assert.equal(snapshot.source.commit,sha);assert.equal(snapshot.files.some(x=>x.path==='.env'),false);
  assert.notEqual(run('0'.repeat(40)).status,0);
  await put(repo,'public/dashboard/index.html','unsaved change');assert.notEqual(run().status,0);
});
