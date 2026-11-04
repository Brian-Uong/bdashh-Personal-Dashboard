import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {canRefreshInBackground,sameSnapshot} from '../public/dashboard/background-refresh.mjs';
import {newsTopic} from '../public/dashboard/news-data.mjs';
const source=await readFile(new URL('../public/dashboard/news.mjs',import.meta.url),'utf8');
function harness(){
 let calls=0,redraws=0,finish;
 const elements=new Map(),state={topics:[],topicsVersion:0,briefings:{}};
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',classList:{toggle(){}},set innerHTML(value){redraws++;},get innerHTML(){return '';}});return elements.get(id);};
 const root={hidden:false,contains:el=>!!el?.inside,querySelector:selector=>selector.startsWith('#')?element(selector.slice(1)):null};
 const doc={hidden:false,activeElement:null,getElementById:()=>root,querySelector:()=>null};
 const win={scrollY:0};
 const context={document:doc,window:win,Date,canRefreshInBackground,sameSnapshot,canEdit:true,findNewsTopics:()=>[],newsTopic:()=>{throw Error();},esc:String,MAX_NEWS_TOPICS:5,renderNewsCard:()=>'',apiFetch:async()=>{calls++;return new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>structuredClone(state)});});}};
 vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nmounted=true;saved='+JSON.stringify(state)+';renderedHour=Math.floor(Date.now()/3600000);this.load=loadNews;',context);
 return {context,doc,win,root,calls:()=>calls,redraws:()=>redraws,finish:()=>finish()};
}
test('news polling pauses while reading, focusing an article, or on another tab',async()=>{
 const h=harness();
 h.win.scrollY=500;await h.context.load();assert.equal(h.calls(),0);
 h.win.scrollY=0;h.doc.activeElement={inside:true,matches:()=>true};await h.context.load();assert.equal(h.calls(),0);
 h.doc.activeElement=null;h.root.hidden=true;await h.context.load();assert.equal(h.calls(),0);
});
test('unchanged news does not rebuild cards or topic controls',async()=>{
 const h=harness(),pending=h.context.load();h.finish();await pending;
 assert.equal(h.calls(),1);assert.equal(h.redraws(),0);
});
test('an in-flight news poll cannot replace the page after the user starts reading',async()=>{
 const h=harness(),pending=h.context.load();h.win.scrollY=500;h.finish();await pending;
 assert.equal(h.redraws(),0);
});

function actions({owner=true,fetcher}={}){
 const h=harness(),requests=[];
 Object.assign(h.context,{requireOwner:()=>{if(!owner)throw Error('Owner required');},newsTopic,canEdit:owner,apiFetch:async(path,options={})=>{
  const body=options.body?JSON.parse(options.body):null;requests.push({path,body});
  return fetcher?fetcher(body):{ok:true,json:async()=>({topics:[newsTopic('Music')],topicsVersion:1,briefings:{},refresh:body?.action==='refresh'?{message:'Fresh headlines loaded.',status:'ready'}:undefined})};
 }});
 vm.runInNewContext("saved={topics:[newsTopic('NBA')],topicsVersion:0,briefings:{}};draft=[newsTopic('Music')];dirty=true;this.save=saveTopics;this.refresh=refreshArticles;this.clean=()=>{dirty=false;};",h.context);
 return {...h,requests};
}
test('saving a topic automatically refreshes the saved selection using the new version',async()=>{
 const h=actions();await h.context.save();
 assert.equal(h.requests.length,2);assert.equal(h.requests[0].body.action,'preferences');
 assert.equal(h.requests[1].body.action,'refresh');assert.equal(h.requests[1].body.baseTopicsVersion,1);assert.deepEqual(h.requests[1].body.topicIds,['music']);
 assert.ok(h.requests.every(r=>r.path==='/api/news'));
});
test('unsaved drafts and failed topic saves never trigger source requests',async()=>{
 const h=actions({fetcher:async()=>({ok:false,json:async()=>({error:'Topics changed elsewhere'})})});
 await h.context.refresh();assert.equal(h.requests.length,0);
 await h.context.save();assert.equal(h.requests.length,1);assert.equal(h.requests[0].body.action,'preferences');
});
test('read-only visitors reload saved articles without starting a refresh',async()=>{
 const h=actions({owner:false});h.context.clean();await h.context.refresh();assert.equal(h.requests.length,1);assert.equal(h.requests[0].body,null);
});
test('switching filters during a refresh checks the latest selected topic after the first finishes',async()=>{
 let finish;const h=actions({fetcher:async body=>{
  if(body.topicIds?.[0]==='nba')await new Promise(resolve=>{finish=resolve;});
  return {ok:true,json:async()=>({topics:[newsTopic('NBA'),newsTopic('F1')],topicsVersion:0,briefings:{},refresh:{status:'ready'}})};
 }});h.context.clean();const first=h.context.refresh(['nba']);
 await h.context.refresh(['f1']);assert.equal(h.requests.length,1);finish();await first;
 assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1].body.topicIds,['f1']);
});
