import test from 'node:test';
import assert from 'node:assert/strict';
import {runStartupCheck} from '../lib/startup-check.mjs';
import {pacificDate} from '../lib/ai-research.mjs';
class Bucket{
  data=new Map();version=0;
  async get(key){const item=this.data.get(key);return item?{etag:item.etag,json:async()=>structuredClone(item.value)}:null;}
  async put(key,value,{onlyIf}={}){
    const old=this.data.get(key);
    if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
    if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
    const etag=String(++this.version);this.data.set(key,{etag,value:JSON.parse(value)});return{etag};
  }
}
test('startup check is inactive without administrator configuration',async()=>{
  assert.equal(await runStartupCheck({},{runner:()=>{throw Error('Must not run');}}),null);
});
test('one-time startup check verifies storage and does not repeat paid research',async()=>{
  const env={STARTUP_CHECK_ID:'launch-test-001',BUCKET:new Bucket()};let calls=0;
  const runner=async(_env,kind)=>{calls++;return{status:'completed',kind};};
  const report=await runStartupCheck(env,{runner});
  assert.equal(report.status,'completed');assert.equal(report.storage,true);assert.equal(calls,2);
  await runStartupCheck(env,{runner});assert.equal(calls,2);
});
test('startup check reuses completed owner research and records provider errors without secret values',async()=>{
  const now=Date.now(),env={STARTUP_CHECK_ID:'launch-test-002',BUCKET:new Bucket()};
  await env.BUCKET.put('ai-runs/'+pacificDate(now)+'-briefing.json',JSON.stringify({status:'completed'}));let calls=0;
  const report=await runStartupCheck(env,{now,runner:async(_env,kind)=>{calls++;assert.equal(kind,'career');throw Error('AI provider request failed (401). Secret should never be logged.');}});
  assert.equal(calls,1);assert.equal(report.status,'failed');assert.equal(report.tasks.briefing.reusedExistingRun,true);
  assert.deepEqual(report.tasks.career,{status:'failed',reason:'PROVIDER_HTTP_401'});
  assert.equal(JSON.stringify(report).includes('Secret'),false);
});
test('startup check stops further paid work when API billing blocks the first task',async()=>{
  const env={STARTUP_CHECK_ID:'launch-quota-001',BUCKET:new Bucket()};let calls=0;
  const report=await runStartupCheck(env,{runner:async()=>{calls++;throw Object.assign(Error('private provider detail'),{providerCode:'insufficient_quota'});}});
  assert.equal(calls,1);assert.equal(report.status,'failed');
  assert.equal(report.tasks.briefing.providerCode,'insufficient_quota');
  assert.deepEqual(report.tasks.career,{status:'skipped',reason:'PROVIDER_BILLING_BLOCKED'});
  assert.equal(JSON.stringify(report).includes('private provider detail'),false);
});
