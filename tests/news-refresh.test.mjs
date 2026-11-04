import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshNews,parseNewsFeed,newsFeedUrl,bingNewsFeedUrl} from '../lib/news-refresh.mjs';
import {saveNews,readNews} from '../lib/news.mjs';
const now=Date.parse('2026-11-03T16:00:00Z');
const item=(i,{date=now-3600000,url='https://news.google.com/rss/articles/story'+i,title='Story '+i,source='Publisher'}={})=>`<item><title><![CDATA[${title} - ${source}]]></title><link>${url}</link><source url="https://example.test">${source}</source><pubDate>${new Date(date).toUTCString()}</pubDate></item>`;
const feed=(rows=Array.from({length:7},(_,i)=>item(i)))=>'<rss><channel>'+rows.join('')+'</channel></rss>';
class Bucket{
 data=new Map();version=0;
 async get(key){const row=this.data.get(key);return row?{etag:row.etag,json:async()=>structuredClone(row.value)}:null;}
 async put(key,value,{onlyIf}={}){const old=this.data.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++this.version);this.data.set(key,{etag,value:JSON.parse(value)});return {etag};}
}
const patch=(topicIds=['nba'],baseTopicsVersion=0)=>({action:'refresh',baseTopicsVersion,topicIds});
test('feed parser rejects stale, future, duplicate, unsafe and undated articles; keeps publisher and date',()=>{
 const rows=[item(1),item(1),item(2,{title:'Story 1'}),item(3,{date:now-49*3600000}),item(4,{date:now+1000}),item(5,{url:'http://news.google.com/rss/articles/bad'}),item(6,{url:'https://evil.test/article'}),item(7,{title:'A &amp; B &#x1f680;'})];
 const items=parseNewsFeed(feed(rows),now);assert.equal(items.length,2);assert.equal(items[1].headline,'A & B 🚀');assert.equal(items[0].format,'feed-headline');assert.equal(items[0].source,'Publisher');
 assert.throws(()=>parseNewsFeed('<html>blocked</html>',now));assert.throws(()=>parseNewsFeed('<!DOCTYPE rss>'+feed(),now));
 const url=new URL(newsFeedUrl({id:'custom-topic',label:'UCI: analytics & AI'}));assert.equal(url.origin,'https://news.google.com');assert.match(url.searchParams.get('q'),/when:2d$/);
});
test('refresh makes only public-feed calls, saves selected topics, reuses recent checks, and fetches new topics immediately',async()=>{
 const bucket=new Bucket();let calls=0;
 const fetcher=async url=>{assert.equal(new URL(url).origin,'https://news.google.com');calls++;return new Response(feed());};
 const first=await refreshNews(bucket,patch(),{fetcher,now});assert.equal(first.refresh.added,7);assert.equal(first.briefings.nba.items.length,7);assert.equal(calls,1);
 const cached=await refreshNews(bucket,patch(),{fetcher,now:now+1000});assert.equal(cached.refresh.status,'cached');assert.equal(calls,1);
 await saveNews(bucket,{action:'preferences',baseTopicsVersion:0,topics:['NBA','Music']},{now:now+2000});
 const music=await refreshNews(bucket,patch(['nba','music'],1),{fetcher,now:now+3000});assert.equal(calls,2);assert.equal(music.refresh.checked,1);assert.equal(music.briefings.music.items.length,7);
 await saveNews(bucket,{action:'preferences',baseTopicsVersion:1,topics:['NBA']},{now:now+4000});
 await saveNews(bucket,{action:'preferences',baseTopicsVersion:2,topics:['NBA','Music']},{now:now+5000});
 const readded=await refreshNews(bucket,patch(['music'],3),{fetcher,now:now+6000});assert.equal(readded.briefings.music.items.length,7);
});
test('failed sources and repeated stories preserve the previous articles and do not pretend to add news',async()=>{
 const bucket=new Bucket();const first=await refreshNews(bucket,patch(),{fetcher:async()=>new Response(feed()),now});
 const repeated=await refreshNews(bucket,patch(),{fetcher:async()=>new Response(feed()),now:now+301000});assert.equal(repeated.refresh.added,0);assert.deepEqual(repeated.briefings.nba.items,first.briefings.nba.items);
 const failed=await refreshNews(bucket,patch(),{fetcher:async()=>new Response('Unavailable',{status:503}),now:now+602000});assert.equal(failed.refresh.status,'failed');assert.deepEqual(failed.briefings.nba.items,first.briefings.nba.items);
 const cached=await refreshNews(bucket,patch(),{fetcher:async()=>{throw Error('Must not run');},now:now+603000});assert.equal(cached.refresh.status,'failed');
});
test('concurrent refresh is bounded and results for changed preferences cannot overwrite the new selection',async()=>{
 const bucket=new Bucket();let finish;const request=refreshNews(bucket,patch(),{now,fetcher:()=>new Promise(resolve=>{finish=()=>resolve(new Response(feed()));})});
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(()=>refreshNews(bucket,patch(),{now,fetcher:()=>{throw Error('Must not run');}}),e=>e.status===429);
 await saveNews(bucket,{action:'preferences',baseTopicsVersion:0,topics:['Music']},{now:now+1});
 finish();await assert.rejects(()=>request,e=>e.status===409);
 const saved=await readNews(bucket);assert.equal(saved.topics[0].id,'music');assert.equal(saved.briefings.nba,undefined);
});
test('refresh rejects arbitrary URLs, unsaved topics and stale versions before any source request',async()=>{
 const bucket=new Bucket(),options={now,fetcher:()=>{throw Error('Must not run');}};
 for(const body of [patch(['unselected']),patch(['nba','nba']),{...patch(),url:'https://evil.test'},patch(['nba'],99)])await assert.rejects(()=>refreshNews(bucket,body,options),e=>[400,409].includes(e.status));
});
test('a redirected feed is not followed and cannot replace saved articles',async()=>{
 const bucket=new Bucket();const first=await refreshNews(bucket,patch(),{fetcher:async()=>new Response(feed()),now});let calls=0;
 const next=await refreshNews(bucket,patch(),{now:now+301000,fetcher:async(url,options)=>{
  calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://other.example/feed'}});
 }});
 assert.equal(calls,2);assert.equal(next.refresh.status,'failed');assert.deepEqual(next.briefings.nba.items,first.briefings.nba.items);
});

const bingItem=(url,date=now-3600000)=>`<item><title>Recent headline</title><link>http://www.bing.com/news/apiclick.aspx?url=${encodeURIComponent(url)}&amp;ref=FexRss</link><News:Source>Publisher</News:Source><pubDate>${new Date(date).toUTCString()}</pubDate></item>`;
test('Bing fallback preserves publisher dates and rejects stale or unsafe destinations',()=>{
 const rows=[bingItem('https://publisher.example/story'),bingItem('https://publisher.example/old',now-49*3600000),bingItem('javascript:alert(1)'),bingItem('https://127.0.0.1/private'),bingItem('https://user:secret@publisher.example/story'),bingItem('https://publisher.example/future',now+1000)];
 const parsed=parseNewsFeed(feed(rows),now,'bing');assert.equal(parsed.length,1);assert.equal(parsed[0].url,'https://publisher.example/story');assert.equal(parsed[0].source,'Publisher');assert.equal(parsed[0].publishedAt,new Date(now-3600000).toISOString());
 assert.equal(parseNewsFeed(feed([bingItem('https://publisher.example/story').replace('www.bing.com/news/apiclick.aspx','evil.example/redirect')]),now,'bing').length,0);
 const url=new URL(bingNewsFeedUrl({id:'custom-topic',label:'BTS & music'}));assert.equal(url.origin,'https://www.bing.com');assert.equal(url.searchParams.get('q'),'"BTS music"');assert.equal(url.searchParams.get('format'),'rss');
});
test('an unavailable primary source uses an independent feed, persists its results and then reuses the cache',async()=>{
 const bucket=new Bucket(),calls=[];
 const fetcher=async(url,options)=>{
  calls.push(new URL(url).origin);assert.equal(options.redirect,'manual');
  return new URL(url).hostname==='news.google.com'?new Response('Unavailable',{status:503}):new Response(feed([bingItem('https://publisher.example/story')]));
 };
 const result=await refreshNews(bucket,patch(),{now,fetcher});assert.equal(result.refresh.status,'ready');assert.equal(result.refresh.added,1);assert.equal(result.briefings.nba.items[0].url,'https://publisher.example/story');assert.deepEqual(calls,['https://news.google.com','https://www.bing.com']);
 assert.deepEqual((await readNews(bucket)).briefings.nba.items,result.briefings.nba.items);
 assert.equal((await refreshNews(bucket,patch(),{now:now+1000,fetcher})).refresh.status,'cached');assert.equal(calls.length,2);
});
