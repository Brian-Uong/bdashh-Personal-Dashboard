import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import * as access from '../lib/dashboard-access.mjs';
const env={DASHBOARD_SERVICE_TOKEN:'test-recommendations-token'};globalThis.__recommendationsTestEnv=env;
const path=new URL('../app/api/recommendations/route.ts',import.meta.url);
let source=(await readFile(path,'utf8')).replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/,'const env=globalThis.__recommendationsTestEnv;');
source=source.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,q,p)=>`from ${JSON.stringify(new URL(p,path).href)}`);
const route=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64'));
function req(payload,owner=true,origin){const r=new Request('https://dashboard.test/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json',...(owner?{'X-Dashboard-Service-Authorization':'Bearer test-recommendations-token'}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(payload)});if(owner&&access.grantVerifiedOwner)access.grantVerifiedOwner(r);return r;}
test('anonymous and cross-origin recommendation writes cannot access storage',async()=>{env.BUCKET={get(){throw Error('Must not read storage');}};assert.equal((await route.POST(req({action:'refresh'},false))).status,403);assert.equal((await route.POST(req({action:'refresh'},true,'https://evil.test'))).status,403);});
test('read-only journal retrieval creates no data and invalid actions are rejected',async()=>{env.BUCKET={get:async()=>null,put(){throw Error('Must not create data');}};assert.equal((await(await route.GET()).json()).records.length,0);assert.equal((await route.POST(req({action:'delete'}))).status,400);assert.equal((await route.POST(req({action:'record',date:'2020-01-01',picks:[]}))).status,400);assert.equal((await route.POST(req([]))).status,400);});
