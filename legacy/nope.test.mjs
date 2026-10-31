import {test} from 'node:test';
import assert from 'node:assert/strict';
const nope=await import('./dist/nope-cannon.mjs').catch(()=>({}));
test('skipping and undoing one event preserves other browser choices',()=>{
 const original={'event:A':123};
 const skipped=nope.setSkipped(original,'event:B',true,456);
 assert.deepEqual(skipped,{'event:A':123,'event:B':456});
 assert.deepEqual(nope.setSkipped(skipped,'event:B',false),original);
 assert.deepEqual(original,{'event:A':123});
});
test('the decorative screen arc starts at home and ends at the event',()=>{
 const home={x:50,y:250},event={x:450,y:250};
 assert.deepEqual(nope.screenArc(home,event,0),home);
 assert.deepEqual(nope.screenArc(home,event,1),event);
 const middle=nope.screenArc(home,event,.5);
 assert.equal(middle.x,250);assert.ok(middle.y<home.y);
});
test('global cinematic launches from Demo launch point and completes at eight seconds',()=>{
 const target=[-117.744,33.65];
 assert.deepEqual(nope.CINEMATIC_ORIGIN,[103.8198,1.3521]);
 assert.equal(nope.CINEMATIC_DURATION,8000);
 assert.equal(nope.cinematicFrame(0,target).phase,'launch');
 assert.equal(nope.cinematicFrame(3200,target).phase,'transit');
 assert.equal(nope.cinematicFrame(5600,target).phase,'approach');
 assert.equal(nope.cinematicFrame(6400,target).phase,'impact');
 assert.equal(nope.cinematicFrame(7999,target).phase,'impact');
 assert.equal(nope.cinematicFrame(8000,target).phase,'complete');
 assert.equal(nope.cinematicFrame(8000,target).remaining,0);
 assert.equal(nope.cinematicFrame(4000,target).remaining,4);
});
test('Pacific crossing stays on one continuous world copy and the camera zooms into the destination',()=>{
 const target=[-117.744,33.65],early=nope.cinematicFrame(1600,target),late=nope.cinematicFrame(6100,target),arrival=nope.cinematicFrame(6400,target);
 assert.ok(late.camera.zoom>early.camera.zoom);
 assert.ok(arrival.position[0]>180);
 assert.ok(Math.abs(arrival.position[0]-360-target[0])<1e-9);
 assert.equal(arrival.position[1],target[1]);
 assert.equal(arrival.lift,0);
});
