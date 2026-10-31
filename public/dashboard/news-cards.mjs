import {newsEscape as esc,newsDate,newsUrl,newsStale,MIN_NEWS_ARTICLES} from './news-data.mjs';
const badge=topic=>({'nba':'NBA','f1':'F1','premier-league':'PL','wnba':'WNBA','nfl':'NFL','mlb':'MLB'}[topic.id]||topic.label.split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase());
export function renderNewsCard(topic,brief,{query='',now=Date.now()}={}){
 const all=Array.isArray(brief?.items)?brief.items:[],q=query.trim().toLowerCase();
 const items=all.filter(item=>!q||[topic.label,item.headline,item.summary,item.source].some(v=>String(v).toLowerCase().includes(q)));
 if(q&&!items.length)return '';
 const stale=all.length&&newsStale(brief?.asOf,now);
 const shortfall=brief&&['ready','partial'].includes(brief.status)&&all.length<MIN_NEWS_ARTICLES;
 const state=!brief?'First edition pending':brief.status==='failed'?'Refresh incomplete':brief.status==='empty'?'No new stories verified':stale?'Previous edition':shortfall?'Limited coverage':'Latest edition';
 const message=!brief?'At least five new articles are requested for every topic each morning.':brief.status==='failed'?'The latest check could not finish. Previously saved articles are kept below.':brief.status==='empty'?'No new articles could be verified in the latest check. Any previous articles remain below.':stale?'This edition is over 36 hours old. Its original publication dates are shown below.':shortfall?`Only ${all.length} of the ${MIN_NEWS_ARTICLES} requested new articles were verified for this edition. Older or duplicate stories are not used to fill the gap.`:'';
 const stories=items.map(item=>{
  const url=newsUrl(item.url),date=newsDate(item.publishedAt),older=item.publishedAt&&now-Date.parse(item.publishedAt)>72*3600000;
  return `<article class="brief-story"><div class="brief-copy"><div class="brief-meta"><span class="brief-source-mark" aria-hidden="true">${esc((item.source||'?')[0].toUpperCase())}</span><span>${esc(item.source)}</span><span class="brief-date">${date?esc(date):'Publication date unavailable'}${older?' · Older context':''}</span></div><h3>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.headline)} <span class="brief-link-arrow" aria-hidden="true">↗</span></a>`:esc(item.headline)}</h3><p>${esc(item.summary)}</p></div><div class="brief-ticker" aria-hidden="true">${esc(badge(topic))}<span>NEWS</span></div></article>`;
 }).join('');
 return `<section class="pd-panel brief-feed news-topic-card" aria-label="${esc(topic.label)} news"><header class="brief-heading"><div><span class="pd-kicker">YOUR DAILY NEWS</span><h2>${esc(topic.label)}<span class="news-edition ${stale||shortfall||brief?.status==='failed'?'news-edition-muted':''}">${esc(state)}</span></h2></div><span class="brief-stamp">${brief?.asOf?esc(newsDate(brief.asOf))+' · PT':'Morning edition · 7 AM PT'}</span></header>${message?`<p class="news-notice">${esc(message)}</p>`:''}${stories?`<div class="brief-stories">${stories}</div>`:''}<footer class="news-card-footer"><span>${brief?.checkedAt?'Last checked '+esc(newsDate(brief.checkedAt,true))+' PT':'Selected for your morning briefing'}</span><span>${items.length} article${items.length===1?'':'s'}</span></footer></section>`;
}
