import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFetch} from '../public/dashboard/api-client.mjs';
test('dashboard requests remain same-origin and never silently follow login HTML',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response('<html>Login</html>',{status:403,headers:{'content-type':'text/html'}});};
  await assert.rejects(apiFetch('https://other.example/api/sync'),/same-origin/);assert.equal(calls,0);
  await assert.rejects(apiFetch('/api/sync'),/session could not be verified/);
  globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/sync');assert.equal(options.cache,'no-store');return Response.json({error:'Conflict'},{status:409});};
  const response=await apiFetch('/api/sync');assert.equal(response.status,409);assert.equal((await response.json()).error,'Conflict');
 }finally{globalThis.fetch=original;}
});
test('network and cancellation failures provide recovery guidance without retrying writes',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw new TypeError('network failure');};
  await assert.rejects(apiFetch('/api/records',{method:'POST',body:'{}'}),/Could not reach/);assert.equal(calls,1);
  await assert.rejects(apiFetch('/api/records',{signal:AbortSignal.abort()}),/save may have completed/);
 }finally{globalThis.fetch=original;}
});
