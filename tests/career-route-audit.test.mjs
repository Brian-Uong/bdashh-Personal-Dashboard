import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import * as access from '../lib/dashboard-access.mjs';
import {researchState} from '../lib/research.mjs';
test('changing career preferences during a provider scan prevents saving obsolete results',async()=>{
 const objects=new Map([['research.json',researchState({})],['discovery.json',{jobs:[],recruiters:[],marker:'keep'}]]);
 const bucket={async get(key){const value=objects.get(key);return value?{etag:'audit',json:async()=>structuredClone(value),text:async()=>JSON.stringify(value)}:null;},async put(key,value){objects.set(key,JSON.parse(value));return {etag:'audit'};}};
 globalThis.__careerAuditEnv={BUCKET:bucket,DASHBOARD_OWNER_EMAIL:'owner@example.test'};
 const file=new URL('../app/api/discovery/refresh/route.ts',import.meta.url);
 let code=(await readFile(file,'utf8')).replace(/import\s*\{env\}\s*from 'cloudflare:workers';/,'const env=globalThis.__careerAuditEnv;').replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,p)=>`from ${JSON.stringify(new URL(p,file).href)}`);
 const route=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'strip'})).toString('base64'));
 const original=globalThis.fetch;
 globalThis.fetch=async()=>{const prefs=objects.get('research.json');objects.set('research.json',{...prefs,revision:prefs.revision+1});return new Response('',{status:503});};
 try{
  const req=new Request('https://dash.example/api/discovery/refresh',{method:'POST',headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}});
  access.grantVerifiedOwner?.(req);
  const response=await route.POST(req);
  assert.equal(response.status,409);assert.match((await response.json()).error,/preferences changed/);
  assert.deepEqual(objects.get('discovery.json'),{jobs:[],recruiters:[],marker:'keep'});
 }finally{globalThis.fetch=original;delete globalThis.__careerAuditEnv;}
});
