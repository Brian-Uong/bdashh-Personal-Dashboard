import {readNews,saveNews} from './news.mjs';
import {newsArticleKey,newsHeadlineKey,MAX_NEWS_ARTICLES} from '../public/dashboard/news-data.mjs';

const LOCK_KEY='news-feed-refresh.json',COOLDOWN=5*60000,FAILURE_COOLDOWN=60000;
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
const decode=value=>String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n]);
const plain=value=>decode(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const tag=(xml,name)=>xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1]||'';

export function newsFeedUrl(topic){
 const label=topic.id==='f1'?'Formula 1':topic.label;
 const words=label.replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ').trim();
 const url=new URL('https://news.google.com/rss/search');
 url.search=new URLSearchParams({q:'"'+words+'" when:2d',hl:'en-US',gl:'US',ceid:'US:en'}).toString();
 return url.href;
}

export function bingNewsFeedUrl(topic){
 const label=topic.id==='f1'?'Formula 1':topic.label;
 const words=label.replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ').trim();
 const url=new URL('https://www.bing.com/news/search');
 url.search=new URLSearchParams({q:'"'+words+'"',format:'rss',sortby:'date',mkt:'en-US'}).toString();
 return url.href;
}

export function parseNewsFeed(xml,now=Date.now(),provider='google'){
 if(!['google','bing'].includes(provider))throw Error('Unknown news provider.');
 if(!/<rss\b/i.test(xml)||!/<channel[\s>]/i.test(xml)||!/<\/channel>/i.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('The news feed returned an unexpected format.');
 const urls=new Set(),headlines=new Set(),items=[];
 for(const match of [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,100)){
  const row=match[1],source=plain(tag(row,provider==='bing'?'News:Source':'source')).slice(0,100),title=plain(tag(row,'title'));
  const headline=(title.endsWith(' - '+source)?title.slice(0,-source.length-3):title).slice(0,180);
  const stamp=Date.parse(plain(tag(row,'pubDate'))),rawUrl=decode(tag(row,'link')).trim();
  let url;try{url=new URL(rawUrl);}catch{continue;}
  if(provider==='google'){
   if(url.origin!=='https://news.google.com'||url.username||url.password||!/^\/(?:rss\/)?articles\/[A-Za-z0-9_-]+$/.test(url.pathname))continue;
  }else{
   // Bing RSS links wrap the publisher URL. Unwrap only that exact public
   // endpoint; the result is displayed as a link, never fetched by the server.
   if(!['http:','https:'].includes(url.protocol)||url.hostname!=='www.bing.com'||url.username||url.password||url.pathname!=='/news/apiclick.aspx')continue;
   try{url=new URL(url.searchParams.get('url'));}catch{continue;}
   if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||/^[\d.]+$/.test(url.hostname)||/\.(?:local|localhost|internal)$/.test(url.hostname))continue;
  }
  if(!source||!headline||!Number.isFinite(stamp)||stamp>now||stamp<now-48*3600000)continue;
  const key=newsArticleKey(url.href),titleKey=newsHeadlineKey(headline);
  if(urls.has(key)||headlines.has(titleKey))continue;
  urls.add(key);headlines.add(titleKey);
  items.push({headline,source,url:url.href,publishedAt:new Date(stamp).toISOString(),summary:'Open the publisher’s article for the full story.',format:'feed-headline'});
 }
 return items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}

async function fetchProvider(url,provider,fetcher,now){
 // Workers supports manual/follow, not the browser-only error mode. Keep
 // redirects disabled by examining the returned status before reading a feed.
 const response=await fetcher(url,{headers:{Accept:'application/rss+xml, application/xml, text/xml'},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`News feed returned HTTP ${response.status}.`);
 if(Number(response.headers.get('content-length')||0)>1500000)throw Error('News feed too large.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw Error('News feed too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return parseNewsFeed(new TextDecoder().decode(bytes),now,provider);
}

async function fetchFeed(topic,fetcher,now){
 const sources=[{provider:'google',url:newsFeedUrl(topic)},{provider:'bing',url:bingNewsFeedUrl(topic)}];
 const failures=[];
 for(const source of sources){
  try{return await fetchProvider(source.url,source.provider,fetcher,now);}
  catch(error){failures.push(source.provider+': '+(error?.name==='TimeoutError'?'Source request timed out.':error?.message||'Source request failed.'));}
 }
 throw Error(failures.join(' '));
}

export async function refreshNews(bucket,patch,{fetcher=fetch,now=Date.now()}={}){
 const state=await readNews(bucket);
 if(!Number.isSafeInteger(patch.baseTopicsVersion)||patch.baseTopicsVersion!==state.topicsVersion)fail('Topics changed in another window. Reload topics before refreshing.',409);
 if(Object.keys(patch).some(key=>!['action','baseTopicsVersion','topicIds'].includes(key)))fail('Invalid news refresh request.',400);
 const ids=patch.topicIds??state.topics.map(t=>t.id);
 if(!Array.isArray(ids)||ids.length>5||ids.some(id=>typeof id!=='string'||!state.topics.some(t=>t.id===id))||new Set(ids).size!==ids.length)fail('Refresh only your saved topics.',400);
 if(!ids.length)return {...state,refresh:{status:'empty',message:'Choose and save a topic to load articles.'}};
 const lock=await bucket.get(LOCK_KEY),before=lock?await lock.json():{};
 if(before.until>now)fail('A news refresh is already running. Try again in a moment.',429);
 const checks=Object.fromEntries(Object.entries(before.checks||{}).filter(([,check])=>check.at>now-86400000).sort((a,b)=>b[1].at-a[1].at).slice(0,50));
 const topics=state.topics.filter(t=>ids.includes(t.id)&&(!state.briefings[t.id]||!checks[t.id]||checks[t.id].at+(checks[t.id].failed?FAILURE_COOLDOWN:COOLDOWN)<=now));
 if(!topics.length){const failed=ids.some(id=>checks[id]?.failed);return {...state,refresh:{status:failed?'failed':'cached',message:failed?'The news feed is temporarily unavailable. Saved articles are retained; try again in a minute.':'These topics were checked within the last five minutes. You’re viewing the latest saved articles.'}};}
 const lease=await bucket.put(LOCK_KEY,JSON.stringify({until:now+60000,checks}),{onlyIf:lock?{etagMatches:lock.etag}:{etagDoesNotMatch:'*'}});
 if(!lease)fail('A news refresh is already running. Try again in a moment.',429);
 try{
  const results=await Promise.all(topics.map(async topic=>{
   try{
    const candidates=await fetchFeed(topic,fetcher,now),previous=state.briefings[topic.id];
    const seenUrls=new Set([...(previous?.seenArticles||[]).map(a=>a.url),...(previous?.items||[]).map(a=>newsArticleKey(a.url))]);
    const seenTitles=new Set([...(previous?.seenArticles||[]).map(a=>a.headline),...(previous?.items||[]).map(a=>newsHeadlineKey(a.headline))]);
    const items=candidates.filter(a=>!seenUrls.has(newsArticleKey(a.url))&&!seenTitles.has(newsHeadlineKey(a.headline))).slice(0,MAX_NEWS_ARTICLES);
    checks[topic.id]={at:now,failed:false};
    return {topicId:topic.id,checkedAt:new Date(now).toISOString(),status:items.length>=5?'ready':items.length?'partial':'empty',items,note:'Headlines from public news feeds. Only stories dated within the past 48 hours are added; open the publisher’s article for full coverage.'};
   }catch(error){
    // Only bounded, credential-free diagnostics; never log response bodies or
    // arbitrary source URLs. Keep last good articles on every failure.
    const reason=error?.name==='TimeoutError'?'Source request timed out.':String(error?.message||'Source request failed.').replace(/https?:\/\/\S+/g,'[source URL]').slice(0,240);
    if(fetcher===fetch)console.warn(JSON.stringify({event:'news_feed_failed',topicId:topic.id,reason}));
    checks[topic.id]={at:now,failed:true};
    return {topicId:topic.id,checkedAt:new Date(now).toISOString(),status:'failed',items:[],note:'The public news feed could not be reached. Saved articles are retained. Try again in a minute.'};
   }
  }));
  const next=await saveNews(bucket,{action:'briefings',baseTopicsVersion:state.topicsVersion,results},{now});
  const failures=results.filter(r=>r.status==='failed').length,added=results.reduce((sum,r)=>sum+r.items.length,0);
  return {...next,refresh:{status:failures===results.length?'failed':failures?'partial':'ready',added,checked:results.length,message:failures===results.length?'The news feed is temporarily unavailable. Saved articles are retained; try again in a minute.':`${added?added+' new article'+(added===1?'':'s')+' loaded.':'No new articles in the past 48 hours were found.'}${failures?' Some topics could not be checked; their saved articles are retained.':''}`}};
 }finally{
  await bucket.put(LOCK_KEY,JSON.stringify({until:0,checks}),{onlyIf:{etagMatches:lease.etag}});
 }
}
