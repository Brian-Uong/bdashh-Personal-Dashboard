import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildLocations} from './dist/map-data.mjs';
import {DEFAULT_HOME} from './dist/commute.mjs';
test('blank project contains no inherited company or event locations',()=>assert.deepEqual(buildLocations({}),[]));
test('default origin is explicitly a public demo location',()=>assert.match(DEFAULT_HOME.precision,/demo.*not.*home/i));
test('workbook coordinates locate companies and events without a private catalogue',()=>{
 const sheets={'Networking Tracker':[[],[],[],['','','Contact','Role','Organization','Latitude','Longitude','Office address'],['','','Demo Person','Analyst','Example Company',51.5,-.1,'Public demo point']], 'Potential Events':[[],[],[],['Event','Date','Time','Location','Latitude','Longitude'],['Demo workshop','','','Public demo point',51.51,-.12]]};
 const result=buildLocations(sheets);assert.equal(result.length,2);assert.deepEqual(result[0].coordinates,[-.1,51.5]);assert.deepEqual(result[1].coordinates,[-.12,51.51]);
});
test('online events and invalid coordinates never become real map pins',()=>{
 const sheets={'Potential Events':[[],[],[],['Event','Date','Time','Location','Latitude','Longitude'],['Online workshop','','','Online',51.5,-.1],['Bad pin','','','Unknown',100,200]]};
 assert.ok(buildLocations(sheets).every(x=>x.coordinates===null));
});
