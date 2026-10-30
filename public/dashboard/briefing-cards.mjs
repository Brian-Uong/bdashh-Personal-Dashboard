const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
function limit(value,max,words=Infinity){
 const text=clean(value),short=text.split(' ').slice(0,words).join(' ');
 if(text.length<=max&&short===text)return text;
 return (short.length>max?short.slice(0,max-1).replace(/\s+\S*$/,''):short).replace(/[.,;:]+$/,'')+'…';
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function dateLabel(value){
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return '';
 // A publication date without a time is a calendar date, not midnight UTC.
 return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00Z':value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'});
}
function normalize(item){
 if(!item||typeof item!=='object')return null;
 const headline=limit(item.headline,110,16),summary=limit(item.summary,280,40);
 if(!headline||!summary)return null;
 const url=safeUrl(item.url);
 const tickers=Array.isArray(item.tickers)?item.tickers.filter(t=>typeof t==='string'&&/^[A-Z][A-Z0-9.-]{0,9}$/.test(t)).slice(0,2):[];
 return {headline,summary,url,tickers,source:limit(item.source,65)|| (url?new URL(url).hostname.replace(/^www\./,''):'Saved briefing'),publishedAt:dateLabel(item.publishedAt),kind:limit(item.kind,24)};
}
// Older saved reports remain readable without migration or invented citations.
export function briefingItems(brief){
 const items=Array.isArray(brief?.items)?brief.items.map(normalize).filter(Boolean):[];
 if(items.length)return items.slice(0,5);
 const text=typeof brief?.text==='string'?brief.text.trim():'';
 const blocks=text.split(/\n\s*\n/).filter(Boolean),result=[];
 for(let i=0;i<blocks.length;i++){
  const lines=blocks[i].split('\n').map(s=>s.trim()).filter(Boolean);
  if(blocks.length>1&&lines.length===1&&lines[0].length<65&&!/[.!?]$/.test(lines[0]))continue;
  const heading=lines.length>1&&/^[A-Z][A-Z /—–-]{4,}$/.test(lines[0])?lines.shift():'';
  if(/PORTFOLIO (CONTEXT|SNAPSHOT)/.test(heading))continue;
  const body=lines.join(' '),prefix=body.match(/^([A-Z]{1,6}(?:\s*\/\s*[A-Z]{1,6})*):\s*/);
  const content=body.replace(/^([A-Z]{1,6}(?:\s*\/\s*[A-Z]{1,6})*):\s*/,'');
  const first=content.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
  const item=normalize({headline:prefix?`${prefix[1]} · ${first}`:first,summary:content,kind:heading||'Update',tickers:prefix?prefix[1].split(/\s*\/\s*/):[]});
  if(item)result.push(item);
  if(result.length===5)break;
 }
 return result;
}
function story(item,asOf){
 const date=item.publishedAt||dateLabel(asOf),badge=item.tickers.join(' / ')||'NEWS';
 return `<article class="brief-story"><div class="brief-copy"><div class="brief-meta"><span class="brief-source-mark" aria-hidden="true">${esc(item.source[0].toUpperCase())}</span><span>${esc(item.source)}</span>${date?`<span class="brief-date">${item.publishedAt?'':'Briefed '}${esc(date)}</span>`:''}</div><h3>${item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.headline)}<span class="brief-link-arrow" aria-hidden="true"> ↗</span></a>`:esc(item.headline)}</h3><p>${esc(item.summary)}</p></div><div class="brief-ticker" aria-hidden="true">${esc(badge)}<span>${esc(item.kind||'UPDATE')}</span></div></article>`;
}
export function renderBriefing(brief,{compact=false,expanded=false}={}){
 const items=briefingItems(brief),date=dateLabel(brief?.asOf),shown=compact?items.slice(0,1):items;
 const sources=(Array.isArray(brief?.sources)?brief.sources:[]).filter(s=>s&&safeUrl(s.url));
 return `<section class="pd-panel pd-daily-briefing brief-feed${compact?' brief-compact':''}" aria-label="Daily investment briefing${compact?' summary':''}"><header class="brief-heading"><div><span class="pd-kicker">DAILY BRIEFING</span><h2>${brief?'Your market, at a glance.':'First briefing pending'}</h2></div>${date?`<span class="brief-stamp">${esc(date)} · PT</span>`:''}</header>${shown.length?`<div class="brief-stories">${shown.map(item=>story(item,brief.asOf)).join('')}</div>`:'<p class="brief-empty">Your researched briefing will appear here after the scheduled update.</p>'}${compact?'<button class="quiet brief-more" data-section="investments" aria-label="Read full daily briefing in Investments">Read more ↗</button>':brief?`<details class="brief-full" data-briefing-details="${esc(brief.asOf)}"${expanded?' open':''}><summary>Read full briefing &amp; sources${items.length?`<span>${items.length} highlights above</span>`:''}</summary><div class="brief-full-text">${esc(brief.text)}</div>${sources.length?`<ul class="brief-sources">${sources.map(s=>`<li><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)} ↗</a></li>`).join('')}</ul>`:''}</details>`:''}</section>`;
}
