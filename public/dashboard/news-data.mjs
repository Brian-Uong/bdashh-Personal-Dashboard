export const MAX_NEWS_TOPICS=5;
export const MIN_NEWS_ARTICLES=5;
export const MAX_NEWS_ARTICLES=10;
export const newsDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function newsArticleKey(value){
 const safe=newsUrl(value);if(!safe)return '';
 const url=new URL(safe);url.hash='';url.hostname=url.hostname.replace(/^www\./,'');
 for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid','mc_cid','mc_eid'].includes(key.toLowerCase()))url.searchParams.delete(key);
 url.searchParams.sort();url.pathname=url.pathname.replace(/\/$/,'')||'/';return url.href;
}
export const newsHeadlineKey=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const NEWS_TOPICS=[
 {id:'nba',label:'NBA',category:'Basketball',aliases:['basketball','national basketball association']},
 {id:'f1',label:'F1',category:'Motorsport',aliases:['formula 1','formula one','formula1','racing']},
 {id:'premier-league',label:'Premier League',category:'Football',aliases:['epl','english premier league','soccer']},
 {id:'wnba',label:'WNBA',category:'Basketball',aliases:['womens basketball']},
 {id:'nfl',label:'NFL',category:'American football',aliases:['football']},
 {id:'mlb',label:'MLB',category:'Baseball',aliases:['baseball']},
 {id:'champions-league',label:'Champions League',category:'Football',aliases:['ucl','uefa']},
 {id:'tennis',label:'Tennis',category:'Sport',aliases:['atp','wta']},
 {id:'technology',label:'Technology',category:'Technology',aliases:['tech','gadgets']},
 {id:'artificial-intelligence',label:'Artificial intelligence',category:'Technology',aliases:['ai']},
 {id:'gaming',label:'Gaming',category:'Entertainment',aliases:['video games','esports']},
 {id:'movies',label:'Movies',category:'Entertainment',aliases:['film','cinema']},
 {id:'music',label:'Music',category:'Entertainment',aliases:[]},
 {id:'space',label:'Space',category:'Science',aliases:['astronomy','nasa']},
 {id:'science',label:'Science',category:'Science',aliases:['research']}
];
const clean=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' '):'';
export function newsTopic(value){
 const label=clean(value);
 if(label.length<2||label.length>60||!/[\p{L}\p{N}]/u.test(label)||/[<>\x00-\x1f\x7f]/.test(label))throw Error('Use a topic name between 2 and 60 characters.');
 const key=label.toLowerCase();
 const found=NEWS_TOPICS.find(t=>t.id===key||t.label.toLowerCase()===key||t.aliases.includes(key));
 return found?{id:found.id,label:found.label}:{id:'custom-'+encodeURIComponent(key),label};
}
export function validateNewsTopics(values){
 if(!Array.isArray(values)||values.length>MAX_NEWS_TOPICS)throw Error('Choose up to five topics.');
 const topics=values.map(newsTopic);
 if(new Set(topics.map(t=>t.id)).size!==topics.length)throw Error('Each topic can only be selected once.');
 return topics;
}
export const defaultNewsTopics=()=>validateNewsTopics(['NBA','F1','Premier League']);
export function findNewsTopics(query){
 const q=clean(query).toLowerCase();
 return NEWS_TOPICS.filter(t=>!q||[t.label,t.category,...t.aliases].some(s=>s.toLowerCase().includes(q)));
}
export function newsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:'';}catch{return '';}}
export const newsEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function newsDate(value,withTime=false){
 if(!value||!Number.isFinite(Date.parse(value)))return '';
 const date=/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00Z':value;
 return new Date(date).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',...(withTime?{hour:'numeric',minute:'2-digit'}:{})});
}
export function newsStale(value,now=Date.now()){return !value||now-Date.parse(value)>36*60*60*1000;}
