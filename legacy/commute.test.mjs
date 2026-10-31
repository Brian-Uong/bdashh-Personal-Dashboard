import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpportunityMap} from './dist/opportunity-map.mjs';
const commute=await import('./dist/commute.mjs').catch(()=>({}));
test('straight-line distance is zero at home and about 111 km per latitude degree',()=>{
 assert.equal(commute.distanceMetres([0,0],[0,0]),0);
 assert.ok(Math.abs(commute.distanceMetres([0,0],[0,1])-111195)<20);
 assert.equal(commute.distanceMetres(null,[0,0]),null);
});
test('only valid successful routing responses produce driving estimates',()=>{
 assert.equal(commute.parseRoute({code:'NoRoute',routes:[]}),null);
 assert.equal(commute.parseRoute({code:'Ok',routes:[{distance:-1,duration:200}]}),null);
 assert.equal(commute.parseRoute({code:'Ok',routes:[{distance:100,duration:NaN}]}),null);
 const route=commute.parseRoute({code:'Ok',routes:[{distance:2500,duration:420,geometry:{type:'LineString',coordinates:[[-117.8,33.6],[-117.7,33.6]]}}]});
 assert.equal(route.distance,2500);assert.equal(route.duration,420);assert.equal(route.geometry.type,'LineString');
});
test('route cache keys distinguish origins as well as destinations',()=>{
 assert.notEqual(commute.routeKey([1,2],[3,4]),commute.routeKey([1,3],[3,4]));
 assert.equal(commute.routeKey([1,2],[3,4]),commute.routeKey([1,2],[3,4]));
});
test('distance and travel-time formatting do not imply live traffic',()=>{
 assert.equal(commute.formatDrive({distance:1609.344,duration:1200}),'20 min · 1.6 km / 1.0 mi');
 assert.equal(commute.formatDrive({distance:10000,duration:4500}),'1 hr 15 min · 10.0 km / 6.2 mi');
});
test('event-tab filtering excludes company pins and events outside filtered rows',()=>{
 const visible=OpportunityMap.prototype.visible.call({locations:[{id:'company',type:'company',contacts:[]},{id:'event1',type:'event',row:4,contacts:[]},{id:'event2',type:'event',row:5,contacts:[]}],allowedEventRows:new Set([5]),filter:'event',query:'',upcoming:false});
 assert.deepEqual(visible.map(x=>x.id),['event2']);
});
test('cached driving estimates expire and are not reused after changing home',()=>{
 const origin=[-117.8,33.6],destination=[-117.7,33.6],route={distance:12000,duration:800,checked:Date.now()},routes={[commute.routeKey(origin,destination)]:route};
 const context={home:{coordinates:origin},routes};
 assert.equal(OpportunityMap.prototype.getRoute.call(context,{coordinates:destination}),route);
 context.home.coordinates=[-117.9,33.6];
 assert.equal(OpportunityMap.prototype.getRoute.call(context,{coordinates:destination}),null);
 context.home.coordinates=origin;route.checked=Date.now()-86400001;
 assert.equal(OpportunityMap.prototype.getRoute.call(context,{coordinates:destination}),null);
});
