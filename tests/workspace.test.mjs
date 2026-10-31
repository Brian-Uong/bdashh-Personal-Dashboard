import test from 'node:test';
import assert from 'node:assert/strict';
import {compareSource} from '../scripts/compare-online-source.mjs';
import {workspaceResponse} from '../scripts/workspace-server.mjs';
import {controlsPreview} from '../scripts/controls-preview.mjs';
test('source comparison detects upstream-only changes, overlapping edits and deleted controls',()=>{
 const base={'settings':'A','auth':'B','page':'C'},local={'settings':'A','auth':'B','page':'D'};
 assert.equal(compareSource(base,local,base).ready,true);
 const result=compareSource(base,local,{'settings':'E','auth':'B','page':'F'});
 assert.deepEqual(result.upstreamChanges,['settings']);assert.deepEqual(result.conflicts,['page']);assert.equal(result.ready,false);
 assert.deepEqual(compareSource(base,{...local,settings:'G'},{auth:'B',page:'C'}).conflicts,['settings']);
 assert.equal(compareSource(base,{...local,settings:'E'},{settings:'E',auth:'B',page:'D'}).ready,true);
});
test('workspace controls are visible but contain no active settings requests',()=>{
 const html=controlsPreview();
 for(const id of ['publicReadOnly','aiEnabled','dailyResearchEnabled'])assert.match(html,new RegExp('id="'+id+'"[^>]*disabled'));
 assert.match(html,/WORKSPACE PREVIEW/);assert.doesNotMatch(html,/<script|fetch\(|OPENAI_API_KEY/);
});
test('workspace rejects every mutation and remote host without touching live services',async()=>{
 const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('No network');};
 try{
  for(const route of ['/api/site-settings','/api/ai/briefing','/api/records','/api/quotes/refresh']){
   const r=await workspaceResponse(new Request('http://127.0.0.1'+route,{method:'POST'}));assert.equal(r.status,409);assert.equal((await r.json()).code,'WORKSPACE_ONLY');
  }
  assert.equal((await workspaceResponse(new Request('https://bdashh.com/owner/settings'))).status,403);
  const r=await workspaceResponse(new Request('http://127.0.0.1/owner/settings'));assert.equal(r.status,200);assert.match(await r.text(),/WORKSPACE PREVIEW/);
  const home=await workspaceResponse(new Request('http://127.0.0.1/dashboard/'));assert.equal(home.status,200);assert.match(await home.text(),/href="\/owner\/settings"/);
  assert.equal(requests,0);
 }finally{globalThis.fetch=original;}
});
