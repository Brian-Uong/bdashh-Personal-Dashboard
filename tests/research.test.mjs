import test from 'node:test';
import assert from 'node:assert/strict';
import {researchState,updateResearch,DEFAULT_RESEARCH_PREFERENCES} from '../lib/research.mjs';
const preferences={...DEFAULT_RESEARCH_PREFERENCES};
test('defaults preserve Brian’s goals and need no search credentials',()=>{
 const s=researchState();assert.match(s.preferences.timing,/June 2027/);assert.match(s.preferences.locations,/Riverside/);assert.equal(s.preferences.includeRemote,true);assert.equal(s.lastRun,null);assert.ok(!JSON.stringify(s).includes('apiKey'));
});
test('saving preferences survives research reports and rejects stale edits',()=>{
 const saved=updateResearch({}, {action:'preferences',baseRevision:0,preferences:{...preferences,locations:'Riverside'}});
 assert.equal(saved.revision,1);assert.equal(saved.preferences.locations,'Riverside');
 assert.throws(()=>updateResearch(saved,{action:'preferences',baseRevision:0,preferences}),/changed elsewhere/);
 const run={status:'partial',mode:'setup',finishedAt:'2026-10-29T04:00:00.000Z',counts:{jobs:0,people:1,events:1},summary:'Verified public matches.',issues:['One job source unavailable.']};
 const reported=updateResearch(saved,{action:'report',run});assert.deepEqual(reported.preferences,saved.preferences);assert.equal(reported.revision,1);assert.deepEqual(reported.lastRun,run);
 const next=updateResearch(reported,{action:'preferences',baseRevision:1,preferences});assert.deepEqual(next.lastRun,run);
 assert.equal(updateResearch(next,{action:'report',run:{...run,finishedAt:'2026-10-28T04:00:00Z'}}).lastRun.finishedAt,run.finishedAt);
});
test('malformed preferences and untrusted status fields cannot be saved',()=>{
 assert.throws(()=>updateResearch({},{action:'preferences',baseRevision:0,preferences:{...preferences,roles:''}}));
 assert.throws(()=>updateResearch({},{action:'preferences',baseRevision:0,preferences:{...preferences,includeRemote:'true'}}));
 assert.throws(()=>updateResearch({},{action:'preferences',baseRevision:0,preferences:{...preferences,locations:'x'.repeat(1501)}}));
 const saved=updateResearch({},{action:'preferences',baseRevision:0,preferences:{...preferences,apiKey:'not-a-real-key'}});assert.equal(saved.preferences.apiKey,undefined);
 assert.throws(()=>updateResearch({},{action:'report',run:{status:'completed',mode:'scheduled',finishedAt:'bad',counts:{jobs:1,people:1,events:1},summary:'Done'}}));
});
