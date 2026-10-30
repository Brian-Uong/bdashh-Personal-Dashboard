import test from 'node:test';
import assert from 'node:assert/strict';
import {serveR2Asset} from '../lib/private-assets.mjs';
const manifest={files:{'/dashboard/index.html':{key:'releases/test/dashboard/index.html',etag:'expected',size:4,type:'text/html; charset=utf-8'},'/dashboard/main.mjs':{key:'releases/test/dashboard/main.mjs',etag:'expected',size:4,type:'text/javascript; charset=utf-8'}}};
test('private assets resolve index pages, retain MIME types, and never read unknown bucket keys',async()=>{
 const keys=[],bucket={async get(key){keys.push(key);return {etag:'expected',size:4,body:'test'};}};
 let r=await serveR2Asset(new Request('https://bdashh.com/dashboard'),bucket,manifest);assert.equal(r.status,302);assert.equal(keys.length,0);
 r=await serveR2Asset(new Request('https://bdashh.com/dashboard/'),bucket,manifest);assert.equal(await r.text(),'test');assert.match(r.headers.get('content-type'),/text\/html/);
 r=await serveR2Asset(new Request('https://bdashh.com/dashboard/main.mjs',{method:'HEAD'}),bucket,manifest);assert.equal(await r.text(),'');assert.match(r.headers.get('content-type'),/javascript/);
 const before=keys.length;for(const name of ['/dashboard.json','/private-data/research.json','/constructor','/api/secrets'])assert.equal((await serveR2Asset(new Request('https://bdashh.com'+name),bucket,manifest)).status,404);assert.equal(keys.length,before);
});
test('missing or mismatched release assets fail without serving unverified content',async()=>{
 for(const object of [null,{etag:'wrong',size:4,body:'bad!'},{etag:'expected',size:5,body:'wrong'}])assert.equal((await serveR2Asset(new Request('https://bdashh.com/dashboard/'),{get:async()=>object},manifest)).status,503);
});
