import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionFromHash,sectionHash,writeSectionHistory} from '../public/dashboard/navigation.mjs';
test('broken links recover and legacy links retain their destinations',()=>{
 for(const hash of ['#%','#!missing','#sports-betting','#fc-trading',''])assert.equal(sectionFromHash(hash),'overview');
 assert.equal(sectionFromHash('#Potential%20Events'),'Potential Events');
 assert.equal(sectionFromHash('#career/applications'),'Application Tracker');
 assert.equal(sectionFromHash('#opportunity-map'),'Potential Events');
 assert.equal(sectionFromHash('#mainContent'),null);
 assert.equal(sectionHash('Application Tracker'),'#career/applications');
});
test('tab navigation creates history but restores and repeated clicks do not duplicate entries',()=>{
 const location={hash:'#overview'},entries=[];
 const history={pushState(_state,_title,hash){entries.push(['push',hash]);location.hash=hash;},replaceState(_state,_title,hash){entries.push(['replace',hash]);location.hash=hash;}};
 writeSectionHistory(history,location,'news');writeSectionHistory(history,location,'news');
 location.hash='#opportunity-map';writeSectionHistory(history,location,'Potential Events',{replace:true});
 assert.deepEqual(entries,[['push','#news'],['replace','#Potential%20Events']]);
});
