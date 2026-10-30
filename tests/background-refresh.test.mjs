import test from 'node:test';
import assert from 'node:assert/strict';
import {canRefreshInBackground,sameSnapshot} from '../public/dashboard/background-refresh.mjs';
test('refresh is allowed at the top, but deferred while reading, editing, expanded or busy',()=>{
 assert.equal(canRefreshInBackground(),true);
 for(const state of [{scrollY:800},{hidden:true},{busy:true},{drafts:true},{localSource:true},{editing:true},{expanded:true}])assert.equal(canRefreshInBackground(state),false,JSON.stringify(state));
 assert.equal(canRefreshInBackground({scrollY:0}),true);
});
test('equivalent responses do not rebuild charts; changed saved content is detected',()=>{
 const old={updatedAt:'2026-10-29',holdings:[{ticker:'KO',shares:2}],briefing:{text:'Morning'}};
 assert.equal(sameSnapshot(old,structuredClone(old)),true);
 const fresh=structuredClone(old);fresh.briefing.text='Updated briefing';assert.equal(sameSnapshot(old,fresh),false);
 assert.equal(sameSnapshot(null,old),false);
});
