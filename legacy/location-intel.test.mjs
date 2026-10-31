import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCafes,claimValues,safeWeb,CoffeeSearch,photonCafes} from './dist/location-intel.mjs';
test('cafes include area centres, deduplicate nearby names, and sort by distance',()=>{const rows=parseCafes({elements:[{type:'node',id:1,lat:33,lon:-117.01,tags:{name:'Far'}},{type:'way',id:2,center:{lat:33,lon:-117.001},tags:{name:'Near'}},{type:'node',id:3,lat:33,lon:-117.00101,tags:{name:'Near'}},{type:'node',id:4,lat:35,lon:-117,tags:{name:'Outside'}}]},[-117,33]);assert.deepEqual(rows.map(r=>r.name),['Near','Far']);assert.equal(rows[0].url,'https://www.openstreetmap.org/way/2');});
test('partial Overpass responses are not presented as complete results',()=>{assert.throws(()=>parseCafes({elements:[],remark:'runtime error'},[-117,33]));});
test('company claims omit historical and deprecated HQs and prefer preferred rank',()=>{const claim=(id,rank,qualifiers)=>({rank,qualifiers,mainsnak:{snaktype:'value',datavalue:{value:{id}}}});assert.deepEqual(claimValues({claims:{P159:[claim('Q1','normal'),claim('Q2','preferred'),claim('Q3','deprecated'),claim('Q4','preferred',{P582:[{}]})]}},'P159'),[{id:'Q2'}]);});
test('external websites reject executable URL schemes',()=>{assert.equal(safeWeb('javascript:alert(1)'),'');assert.equal(safeWeb('https://example.com'),'https://example.com/');});

const cafeData={elements:[{type:'node',id:1,lat:33,lon:-117,tags:{name:'Test café'}}]};
const photonData={features:[{type:'Feature',geometry:{type:'Point',coordinates:[-117,33]},properties:{osm_key:'amenity',osm_value:'cafe',osm_type:'N',osm_id:1,name:'Test café'}}]};
const origin=[-117,33];
test('coffee uses the working provider and reuses persisted results after reload',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};let calls=0;
 const fetchImpl=async(url,options)=>{calls++;assert.equal(new URL(url).hostname,'photon.komoot.io');assert.equal(new URL(url).searchParams.get('osm_tag'),'amenity:cafe');assert.equal(new URL(url).searchParams.get('radius'),'1.5');assert.ok(options.signal);return {ok:true,json:async()=>photonData};};
 const first=new CoffeeSearch({fetchImpl,storage,now:()=>1000000});
 assert.equal((await first.search(origin)).rows[0].name,'Test café');
 await first.search(origin);
 const reloaded=new CoffeeSearch({fetchImpl,storage,now:()=>1001000});await reloaded.search(origin);
 assert.equal(calls,1);
});
test('coffee aborts a stalled fetch, clears its lock and avoids immediate repeat requests',async()=>{
 let calls=0,clock=1000000;
 const search=new CoffeeSearch({now:()=>clock,timeoutMs:5,storage:null,fetchImpl:(_,options)=>{calls++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}});
 await assert.rejects(search.search(origin),/not responding/);
 await assert.rejects(search.search(origin),/30 seconds/);assert.equal(calls,1);
 clock+=31000;search.fetchImpl=async()=>({ok:true,json:async()=>photonData});
 assert.equal((await search.search(origin)).rows.length,1);
});
test('failed responses never poison the cache and empty success is cached',async()=>{
 let calls=0,clock=1000000;
 const search=new CoffeeSearch({storage:null,now:()=>clock,fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
 await assert.rejects(search.search(origin),/busy/);
 clock+=31000;search.fetchImpl=async()=>{calls++;return {ok:true,json:async()=>({features:[]})};};
 assert.deepEqual((await search.search(origin)).rows,[]);await search.search(origin);assert.equal(calls,2);
});
test('expired and malformed saved coffee data are ignored, unavailable storage is harmless',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>photonData};};
 const storage={getItem:()=>JSON.stringify([[origin.join(','),{data:cafeData,checked:1}]]),setItem:()=>{throw Error('Quota');}};
 await new CoffeeSearch({storage,fetchImpl,now:()=>2000000}).search(origin);assert.equal(calls,1);
 storage.getItem=()=>'{broken';await new CoffeeSearch({storage,fetchImpl}).search(origin);assert.equal(calls,2);
});

test('Photon café parser excludes non-cafés, bad geometry and unsafe IDs',()=>{
 const cafe=photonData.features[0];
 const d={features:[cafe,{...cafe,properties:{...cafe.properties,osm_value:'restaurant'}},{...cafe,geometry:{type:'Point',coordinates:[null,33]}},{...cafe,properties:{...cafe.properties,osm_id:'oops'}}]};
 assert.equal(parseCafes(photonCafes(d),origin).length,1);
 assert.throws(()=>photonCafes({error:'offline'}));
});
