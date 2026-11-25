import test from 'node:test';
import assert from 'node:assert/strict';
import {mountGlassMotion} from '../public/dashboard/glass-motion.mjs';

// Event/animation boundary fixture: no network, saved dashboard data or timers.
function setup({native = false, grouped = false, ready = true} = {}) {
  const doc = new EventTarget(), preference = new EventTarget();
  preference.matches = false;
  const frames = new Map(), calls = [];
  let next = 0;
  const classes = new Set(['glass-workspace']);
  const body = {dataset:{dashboardReady:String(ready)},classList:{contains:value=>classes.has(value),add:value=>classes.add(value),remove:value=>classes.delete(value)}};
  let attributeCallback;
  const win = {
    innerHeight:800,matchMedia:()=>preference,
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},
    cancelAnimationFrame:id=>frames.delete(id),
    MutationObserver:class {constructor(fn){attributeCallback=fn;}observe(){}disconnect(){}}
  };
  const element = ({name,top=0,canvas=false,children=[],panel=false}) => ({
    name,isConnected:true,closest:()=>null,
    getBoundingClientRect:()=>({width:400,height:100,top,bottom:top+100}),
    matches:selector=>selector==='.pageheading'&&name==='heading'||selector==='.pd-panel, .panel'&&panel,
    querySelector:()=>canvas?{}:null,
    contains:other=>children.includes(other),
    animate(keyframes,options){
      let resolve;
      const animation={cancelled:false,finished:new Promise(r=>{resolve=r;}),cancel(){this.cancelled=true;resolve();},finish(){resolve();}};
      calls.push({name,keyframes,options,animation});return animation;
    }
  });
  const inner=element({name:'inner'});
  const nodes=[element({name:'heading'}),element({name:'outer',children:[inner],panel:grouped}),inner,element({name:'map',canvas:true}),element({name:'offscreen',top:900})];
  const main={querySelectorAll:()=>nodes};
  Object.assign(doc,{body,defaultView:win,hidden:false,querySelector:s=>s==='main'?main:null});
  const openings=[];
  if(native) {
    doc.getElementById=()=>main;
    doc.startViewTransition=update=>{
      update();let finish;
      const transition={skipped:false,ready:Promise.resolve(),finished:new Promise(r=>{finish=r;}),
        skipTransition(){this.skipped=true;finish();},finish(){finish();}};
      openings.push(transition);return transition;
    };
  }
  const cleanup=mountGlassMotion(doc);
  const flush=()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());};
  const send=type=>doc.dispatchEvent(new Event(type));
  return {doc,preference,classes,calls,frames,openings,flush,send,cleanup,changeClass:()=>attributeCallback()};
}

test('only intentional navigation animates, once per visible outer surface; canvas ancestors stay stationary',()=>{
  const f=setup();
  for(const type of ['portfolio-synced','input','change','scroll'])f.send(type);
  f.flush();assert.equal(f.calls.length,0);
  f.send('dashboard:sectionchange');f.flush();
  assert.deepEqual(f.calls.map(c=>c.name),['heading','outer','map']);
  const map=f.calls.find(c=>c.name==='map');
  assert.ok(map.keyframes.every(k=>!('translate'in k)&&!('scale'in k)&&!('transform'in k)));
  assert.ok(f.calls.every(c=>c.options.fill==='backwards'));
  f.cleanup();assert.ok(f.calls.every(c=>c.animation.cancelled));
});

test('rapid tab changes cancel previous entrances and coalesce to the last pending frame',()=>{
  const f=setup();f.send('dashboard:sectionchange');f.flush();
  const old=f.calls.slice();
  f.send('dashboard:sectionchange');f.send('dashboard:sectionchange');f.send('dashboard:sectionchange');
  assert.ok(old.every(c=>c.animation.cancelled));assert.equal(f.frames.size,1);
  f.flush();assert.equal(f.calls.length,6);
  f.cleanup();f.send('dashboard:sectionchange');assert.equal(f.frames.size,0);
});

test('reduced motion, saved motion-off and hidden pages cancel running transitions and prevent new ones',()=>{
  const f=setup();f.send('dashboard:sectionchange');f.flush();
  f.preference.matches=true;f.preference.dispatchEvent(new Event('change'));
  assert.ok(f.calls.every(c=>c.animation.cancelled));
  f.send('dashboard:sectionchange');f.flush();assert.equal(f.calls.length,3);
  f.preference.matches=false;f.classes.add('no-motion');f.changeClass();
  f.send('dashboard:sectionchange');f.flush();assert.equal(f.calls.length,3);
  f.classes.delete('no-motion');f.doc.hidden=true;f.send('visibilitychange');
  f.send('dashboard:sectionchange');f.flush();assert.equal(f.calls.length,3);
  f.doc.hidden=false;f.send('dashboard:sectionchange');f.flush();assert.equal(f.calls.length,6);
  f.cleanup();
});

test('native opening runs once, releases its snapshot class, and never repeats for data or navigation',async()=>{
  const f=setup({native:true});f.flush();
  assert.equal(f.openings.length,1);assert.ok(f.classes.has('workspace-revealing'));
  f.openings[0].finish();await Promise.resolve();
  assert.equal(f.classes.has('workspace-revealing'),false);
  f.send('portfolio-synced');f.flush();assert.equal(f.calls.length,0);
  f.send('dashboard:sectionchange');f.flush();
  assert.equal(f.openings.length,1);assert.equal(f.calls.length,3);
  f.cleanup();
});

test('navigation and reduced motion interrupt the opening without deferring navigation',async()=>{
  const f=setup({native:true});f.flush();
  f.send('dashboard:sectionchange');f.flush();
  assert.equal(f.openings[0].skipped,true);assert.equal(f.calls.length,3);
  await Promise.resolve();assert.equal(f.classes.has('workspace-revealing'),false);f.cleanup();
  const disabled=setup({native:true});disabled.preference.matches=true;disabled.flush();
  assert.equal(disabled.openings.length,0);disabled.cleanup();
  const toggled=setup({native:true});toggled.flush();toggled.classes.add('no-motion');toggled.changeClass();
  assert.equal(toggled.openings[0].skipped,true);await Promise.resolve();
  assert.equal(toggled.classes.has('workspace-revealing'),false);toggled.cleanup();
});

test('navigation before the opening and unsupported browsers use the normal card transition',()=>{
  const f=setup({native:true});f.send('dashboard:sectionchange');f.flush();
  assert.equal(f.openings.length,0);assert.equal(f.calls.length,3);f.cleanup();
  const fallback=setup();fallback.send('dashboard:sectionchange');fallback.flush();
  assert.equal(fallback.calls.length,3);fallback.cleanup();
});

test('card grids reveal their children rather than compounding container transforms',()=>{
  const f=setup({grouped:true});f.send('dashboard:sectionchange');f.flush();
  assert.deepEqual(f.calls.map(c=>c.name),['heading','inner','map']);
  assert.ok(f.calls.find(c=>c.name==='map').keyframes.every(k=>!('translate'in k)&&!('scale'in k)));
  f.cleanup();
});

test('initial routing finishes before the opening snapshot, in either module-load order',()=>{
  const f=setup({native:true,ready:false});
  f.send('dashboard:sectionchange');f.flush();assert.equal(f.calls.length,0);assert.equal(f.openings.length,0);
  f.send('dashboard:ready');f.flush();assert.equal(f.openings.length,1);
  f.send('dashboard:ready');f.flush();assert.equal(f.openings.length,1);f.cleanup();
});
