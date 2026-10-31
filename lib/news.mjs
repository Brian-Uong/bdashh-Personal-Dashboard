import {defaultNewsTopics,validateNewsTopics,newsUrl,newsDay,newsArticleKey,newsHeadlineKey,MIN_NEWS_ARTICLES,MAX_NEWS_ARTICLES} from '../public/dashboard/news-data.mjs';
export const NEWS_KEY='news.json';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
export function newsState(saved){
 if(!saved)return {schemaVersion:1,revision:0,topicsVersion:0,topics:defaultNewsTopics(),briefings:{},updatedAt:null};
 if(saved.schemaVersion!==1||!Number.isSafeInteger(saved.revision)||!Number.isSafeInteger(saved.topicsVersion)||!Array.isArray(saved.topics)||!saved.briefings)fail('Saved news is temporarily unavailable.',503);
 return saved;
}
function validDate(value,now){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+300000;}
function normalizeArticle(item,now){
 if(!item||typeof item!=='object')fail('Invalid news article.');
 const headline=text(item.headline,180),summary=text(item.summary,600),source=text(item.source,100),url=newsUrl(item.url);
 if(!headline||!summary||!source||!url)fail('Articles need a headline, summary, publisher and HTTPS source link.');
 let publishedAt=null;
 if(item.publishedAt){
  if(!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(item.publishedAt)||!validDate(item.publishedAt,now)||new Date(item.publishedAt).toISOString().slice(0,10)!==item.publishedAt.slice(0,10))fail('Invalid or future publication date.');
  publishedAt=item.publishedAt;
 }
 return {headline,summary,source,url,publishedAt};
}
export function updateNews(saved,patch,now=Date.now()){
 const state=newsState(saved);
 if(!patch||typeof patch!=='object'||Array.isArray(patch))fail('Invalid news update.');
 if(!Number.isSafeInteger(patch.baseTopicsVersion)||patch.baseTopicsVersion!==state.topicsVersion)fail('Topics changed in another window. Reload saved topics before trying again.',409);
 const stamp=new Date(now).toISOString();
 if(patch.action==='preferences'){
  let topics;try{topics=validateNewsTopics(patch.topics);}catch(error){fail(error.message);}
  if(JSON.stringify(topics)===JSON.stringify(state.topics))return state;
  const ids=new Set(topics.map(t=>t.id));
  return {...state,topics,topicsVersion:state.topicsVersion+1,revision:state.revision+1,updatedAt:stamp,briefings:Object.fromEntries(Object.entries(state.briefings).filter(([id])=>ids.has(id)))};
 }
 if(patch.action!=='briefings'||!Array.isArray(patch.results)||patch.results.length>5)fail('Invalid news results.');
 const briefings={...state.briefings},ids=new Set(state.topics.map(t=>t.id)),seen=new Set();let changed=false;
 for(const result of patch.results){
  if(!result||!ids.has(result.topicId)||seen.has(result.topicId))fail('News results must match the selected topics.');
  seen.add(result.topicId);
  if(!validDate(result.checkedAt,now)||!['ready','partial','empty','failed'].includes(result.status))fail('Invalid news refresh status or time.');
  const previous=briefings[result.topicId];
  // Idempotent retries and out-of-order runs never replace a newer result.
  if(previous?.checkedAt&&Date.parse(result.checkedAt)<=Date.parse(previous.checkedAt))continue;
  let items=previous?.items||[],asOf=previous?.asOf||null,status=result.status,newCount=0;
  const editionDay=newsDay(result.checkedAt);
  // Seed history from legacy cards; do not turn yesterday's articles into today's news.
  let seenArticles=Array.isArray(previous?.seenArticles)?[...previous.seenArticles]:[];
  for(const item of previous?.items||[]){
   const key=newsArticleKey(item.url);if(key&&!seenArticles.some(row=>row.url===key))seenArticles.push({url:key,headline:newsHeadlineKey(item.headline),day:previous.asOf?newsDay(previous.asOf):''});
  }
  if(['ready','partial'].includes(result.status)){
   if(!Array.isArray(result.items)||!result.items.length||result.items.length>MAX_NEWS_ARTICLES)fail('Provide up to ten sourced articles per topic; aim for at least five.');
   const uniqueUrls=new Set(),uniqueHeadlines=new Set();
   const fresh=result.items.map(item=>normalizeArticle(item,now)).filter(item=>{
    const url=newsArticleKey(item.url),headline=newsHeadlineKey(item.headline);
    if(uniqueUrls.has(url)||uniqueHeadlines.has(headline)||seenArticles.some(row=>(row.url===url||row.headline===headline)&&row.day!==editionDay))return false;
    uniqueUrls.add(url);uniqueHeadlines.add(headline);return true;
   });
   newCount=fresh.length;status=newCount>=MIN_NEWS_ARTICLES?'ready':newCount?'partial':'empty';
   if(fresh.length){
    items=fresh;asOf=result.checkedAt;
    for(const item of items){const url=newsArticleKey(item.url);if(!seenArticles.some(row=>row.url===url))seenArticles.push({url,headline:newsHeadlineKey(item.headline),day:editionDay});}
   }
  }
  briefings[result.topicId]={status,checkedAt:result.checkedAt,asOf,items,newCount,targetCount:MIN_NEWS_ARTICLES,seenArticles:seenArticles.slice(-500),note:text(result.note,300)};changed=true;
 }
 return changed?{...state,briefings,revision:state.revision+1,updatedAt:stamp}:state;
}
export async function readNews(bucket){if(!bucket)fail('News storage is unavailable.',503);const object=await bucket.get(NEWS_KEY);return newsState(object?await object.json():null);}
export async function saveNews(bucket,patch,{now=Date.now()}={}){
 if(!bucket)fail('News storage is unavailable.',503);
 for(let attempt=0;attempt<3;attempt++){
  const object=await bucket.get(NEWS_KEY),before=newsState(object?await object.json():null),next=updateNews(before,patch,now);
  if(next===before)return before;
  const saved=await bucket.put(NEWS_KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json'},onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'}});
  if(saved)return next;
 }
 fail('News changed during the save. Reload to check the latest version.',409);
}
