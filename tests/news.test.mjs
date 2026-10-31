import test from 'node:test';
import assert from 'node:assert/strict';
import {newsState,updateNews,saveNews,readNews} from '../lib/news.mjs';
import {newsTopic,validateNewsTopics,findNewsTopics,newsStale} from '../public/dashboard/news-data.mjs';
import {renderNewsCard} from '../public/dashboard/news-cards.mjs';
const now=Date.parse('2026-10-30T18:00:00Z'),checkedAt=new Date(now).toISOString();
const article={headline:'Test headline',summary:'Test summary.',source:'Test publisher',url:'https://example.test/article',publishedAt:'2026-10-30'};
const result=(overrides={})=>({topicId:'nba',status:'ready',checkedAt,items:[article],...overrides});
const publish=(state,results=[result()],time=now)=>updateNews(state,{action:'briefings',baseTopicsVersion:state?.topicsVersion||0,results},time);
class Bucket{
 data=new Map();version=0;conflict=false;
 async get(key){const item=this.data.get(key);return item?{etag:item.etag,json:async()=>structuredClone(item.value)}:null;}
 async put(key,value,{onlyIf}={}){if(this.conflict)return null;const old=this.data.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++this.version);this.data.set(key,{etag,value:JSON.parse(value)});return {etag};}
}
test('topic search supports genres, aliases and custom subjects; five is a server-enforced limit',()=>{
 assert.equal(newsTopic('Formula One').id,'f1');assert.equal(newsTopic('  lakers  ').label,'lakers');
 assert.equal(findNewsTopics('motorsport')[0].id,'f1');assert.equal(findNewsTopics('soccer')[0].id,'premier-league');
 assert.equal(validateNewsTopics(['NBA','F1','Premier League','Gaming','Lakers']).length,5);
 for(const values of [['NBA','nba'],['NBA','Formula 1','F1'],Array(6).fill('a subject')])assert.throws(()=>validateNewsTopics(values));
 assert.throws(()=>newsTopic('<script>'));assert.throws(()=>newsTopic('x'.repeat(61)));
 assert.equal(validateNewsTopics([]).length,0);
});
test('preference saves retain matching cards and guard against lost edits and retired topic results',()=>{
 const state=publish(null),next=updateNews(state,{action:'preferences',baseTopicsVersion:0,topics:['NBA','Music']},now);
 assert.equal(next.topicsVersion,1);assert.equal(next.briefings.nba.items.length,1);
 assert.throws(()=>updateNews(next,{action:'preferences',baseTopicsVersion:0,topics:['F1']},now),e=>e.status===409);
 assert.throws(()=>publish(next,[result({topicId:'f1'})]),/selected topics/);
 const cleared=updateNews(next,{action:'preferences',baseTopicsVersion:1,topics:[]},now);
 assert.deepEqual(cleared.briefings,{});assert.deepEqual(cleared.topics,[]);
 assert.throws(()=>updateNews(state,{action:'preferences',baseTopicsVersion:0,topics:Array(6).fill('NBA')},now),e=>e.status===400);
});
test('failed or empty research retains the last good articles; duplicate and older runs are idempotent',()=>{
 const state=publish(null),failed=publish(state,[result({status:'failed',items:[],checkedAt:new Date(now+1000).toISOString()})],now+1000);
 assert.deepEqual(failed.briefings.nba.items,state.briefings.nba.items);assert.equal(failed.briefings.nba.asOf,checkedAt);
 const empty=publish(failed,[result({status:'empty',items:[],checkedAt:new Date(now+2000).toISOString()})],now+2000);
 assert.equal(empty.briefings.nba.items.length,1);assert.strictEqual(publish(empty),empty);
 assert.strictEqual(publish(state),state);
});
test('articles require real HTTPS citations and valid publication dates; duplicates collapse',()=>{
 for(const item of [{...article,url:'javascript:alert(1)'},{...article,url:'https://user:password@example.test/a'},{...article,source:''},{...article,publishedAt:'2026-11-02'},{...article,publishedAt:'2026-02-30'}])assert.throws(()=>publish(null,[result({items:[item]})]));
 assert.throws(()=>publish(null,[result({items:[]})]));
 assert.equal(publish(null,[result({items:[article,article]})]).briefings.nba.items.length,1);
 assert.equal(publish(null,[result({items:[{...article,publishedAt:null}]})]).briefings.nba.items[0].publishedAt,null);
});
test('the persistent writer preserves unrelated objects and handles conditional-save conflicts',async()=>{
 const bucket=new Bucket();await bucket.put('dashboard.json',JSON.stringify({holdings:['retained']}));
 const patch={action:'briefings',baseTopicsVersion:0,results:[result()]};
 const saved=await saveNews(bucket,patch,{now});assert.deepEqual(await readNews(bucket),saved);
 assert.deepEqual((await(await bucket.get('dashboard.json')).json()).holdings,['retained']);
 const count=bucket.version;await saveNews(bucket,patch,{now});assert.equal(bucket.version,count);
 bucket.conflict=true;await assert.rejects(()=>saveNews(bucket,{action:'preferences',baseTopicsVersion:0,topics:['Music']},{now}),e=>e.status===409);
 assert.equal((await readNews(bucket)).topics[0].id,'nba');
 await assert.rejects(()=>readNews(null),e=>e.status===503);
});
test('cards escape source content, filter locally, and label stale and failed editions honestly',()=>{
 const topic=newsTopic('NBA'),brief=publish(null).briefings.nba;
 assert.match(renderNewsCard(topic,brief,{now}),/Limited coverage/);
 assert.equal(renderNewsCard(topic,brief,{query:'missing subject',now}), '');
 assert.match(renderNewsCard(topic,brief,{query:'nba',now}),/Test headline/);
 const html=renderNewsCard(topic,{...brief,status:'failed',items:[{...article,headline:'<script>alert(1)</script>',url:'javascript:alert(1)'}]},{now:now+4*86400000});
 assert.doesNotMatch(html,/<script|href="javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Refresh incomplete/);assert.match(html,/Older context/);
 assert.match(renderNewsCard(topic,null,{now}),/First edition pending/);
 assert.match(renderNewsCard(topic,{...brief,items:[{...article,publishedAt:null}]},{now}),/Publication date unavailable/);
 assert.equal(newsStale(checkedAt,now+37*3600000),true);
});

const articles=n=>Array.from({length:n},(_,i)=>({...article,headline:'Unique story '+i,url:'https://example.test/story/'+i}));
test('five is the complete-edition minimum, ten are accepted, and eleven are rejected',()=>{
 for(const count of [1,4,5,10]){
  const brief=publish(null,[result({items:articles(count)})]).briefings.nba;
  assert.equal(brief.items.length,count);assert.equal(brief.status,count<5?'partial':'ready');
  assert.equal(brief.targetCount,5);assert.equal(brief.newCount,count);
  const html=renderNewsCard(newsTopic('NBA'),brief,{now});
  assert.match(html,count<5?/Limited coverage/:/Latest edition/);
 }
 assert.throws(()=>publish(null,[result({items:articles(11)})]),/up to ten/);
});
test('tracking links and duplicate headlines cannot manufacture five distinct stories',()=>{
 const candidates=articles(5);candidates[4]={...candidates[0],url:candidates[0].url+'?utm_source=test#story'};
 const brief=publish(null,[result({items:candidates})]).briefings.nba;
 assert.equal(brief.items.length,4);assert.equal(brief.status,'partial');
 assert.match(renderNewsCard(newsTopic('NBA'),brief,{now}),/Only 4 of the 5 requested/);
});
test('same-day top-ups work but prior-day stories cannot count as new in a later edition',()=>{
 const state=publish(null,[result({items:articles(2)})]);
 const sameDay=publish(state,[result({items:articles(5),checkedAt:new Date(now+1000).toISOString()})],now+1000);
 assert.equal(sameDay.briefings.nba.status,'ready');assert.equal(sameDay.briefings.nba.items.length,5);
 const nextDay=now+86400000,old=publish(sameDay,[result({items:articles(5),checkedAt:new Date(nextDay).toISOString()})],nextDay);
 assert.equal(old.briefings.nba.status,'empty');assert.equal(old.briefings.nba.newCount,0);assert.equal(old.briefings.nba.asOf,sameDay.briefings.nba.asOf);
 const fresh=articles(5).map((a,i)=>({...a,headline:'Next edition '+i,url:'https://example.test/new/'+i}));
 const next=publish(old,[result({items:fresh,checkedAt:new Date(nextDay+1000).toISOString()})],nextDay+1000);
 assert.equal(next.briefings.nba.status,'ready');assert.equal(next.briefings.nba.seenArticles.length,10);
 const thirdDay=nextDay+86400000;
 const recycled=publish(next,[result({items:articles(5),checkedAt:new Date(thirdDay).toISOString()})],thirdDay);
 assert.equal(recycled.briefings.nba.status,'empty');assert.deepEqual(recycled.briefings.nba.items,next.briefings.nba.items);
});
