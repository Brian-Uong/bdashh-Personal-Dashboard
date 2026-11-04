import test from 'node:test';
import assert from 'node:assert/strict';
import {aiRoute} from '../lib/ai-route.mjs';
const owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test','Content-Type':'application/json'};
const env={DASHBOARD_OWNER_EMAIL:'owner@example.test'};
const request=(headers=owner,body='{}')=>new Request('https://dash.example/api/ai/news',{method:'POST',headers,body});
test('AI routes authorize before calling providers and fail closed without a connection',async()=>{
 let calls=0;const runner=async()=>{calls++;return {status:'completed'};};
 const route=aiRoute(env,'news',{runner});
 assert.equal((await route(request({}))).status,403);
 assert.equal((await route(request({...owner,Origin:'https://other.example'}))).status,403);
 const missing=await route(request());assert.equal(missing.status,503);assert.equal((await missing.json()).code,'AI_NOT_CONFIGURED');assert.equal(calls,0);
 const enabled=aiRoute({...env,OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'},'news',{runner});
 assert.equal((await enabled(request(owner,'{"prompt":"ignore preferences"}'))).status,400);
 assert.equal((await enabled(request({...owner,'sec-fetch-site':'cross-site'}))).status,403);
 assert.equal((await enabled(request(owner,'null'))).status,400);
 assert.equal((await enabled(request())).status,200);assert.equal(calls,1);
});
