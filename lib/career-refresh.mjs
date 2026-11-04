import {localRegion} from '../public/dashboard/local-regions.mjs';
export const CAREER_SOURCES=[
 {key:'fender',name:'Fender',kind:'greenhouse',url:'https://boards-api.greenhouse.io/v1/boards/fender/jobs'},
 {key:'andurilindustries',name:'Anduril Industries',kind:'greenhouse',url:'https://boards-api.greenhouse.io/v1/boards/andurilindustries/jobs'},
 {key:'brightonjones',name:'Brighton Jones',kind:'lever',url:'https://api.lever.co/v0/postings/brightonjones?mode=json'},
 {key:'burtchworks',name:'Burtch Works',kind:'people',url:'https://burtchworks.com/about-us'},
 {key:'esri',name:'Esri',kind:'greenhouse',url:'https://boards-api.greenhouse.io/v1/boards/esri/jobs'}
];
export function plainText(s){return String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/g,"'").replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
function safeUrl(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const canonical=s=>{
 try{const u=new URL(s);const path=u.pathname.replace(/\/$/,'');
  // Greenhouse publishes the same vacancy through two hosts and tracking URLs.
  if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname)&&/^\/[^/]+\/jobs\/\d+$/.test(path))return 'greenhouse:'+path;
  for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['gh_jid','source','ref'].includes(key))u.searchParams.delete(key);
  u.hash='';u.pathname=path;return u.href.replace(/\/$/,'');
 }catch{return String(s||'').replace(/\/$/,'')}
};
export function leadKey(x,kind){return kind==='recruiters'?`${slug(x.name)}|${slug(x.company)}`:canonical(x.url);}
const region=s=>localRegion(s)||(/remote/i.test(s)?'Remote':'Other');
export function jobMatches(title,location,p){
 const wanted=String(p.roles||'').toLowerCase();
 const phrases=wanted.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
 const titleMatch=phrases.some(x=>title.toLowerCase().includes(x))||(/analyst|analytics/.test(wanted)&&/analyst|analytics|business intelligence|business operations/i.test(title))||(/financ|fp&a/.test(wanted)&&/financ|fp&a/i.test(title))||(/consult/.test(wanted)&&/consultant|consulting/i.test(title));
 if(!titleMatch)return false;
 if(!/senior|manager|director|principal|lead|head/i.test(wanted)&&/\b(senior|sr\.?|manager|director|principal|lead|head|vp)\b/i.test(title))return false;
 const loc=location.toLowerCase();
 if(/remote/i.test(loc))return p.includeRemote===true&&!/europe|united kingdom|canada|australia|germany|london|apac/i.test(loc);
 const places=String(p.locations||'').split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
 return places.some(x=>['orange county','inland empire'].includes(x)?localRegion(location).toLowerCase()===x:loc.includes(x)&&(!localRegion(x)||!!localRegion(location)));
}
export async function fetchText(url,fetcher){
 const res=await fetcher(url,{headers:{Accept:'application/json, text/html;q=0.9'},signal:AbortSignal.timeout(22000),redirect:'follow'});
 if(!res.ok)throw Error(`Source returned HTTP ${res.status}.`);
 if(Number(res.headers.get('content-length')||0)>4500000)throw Error('Source response was too large.');
 const reader=res.body.getReader();const chunks=[];let bytes=0;
 while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4500000){await reader.cancel();throw Error('Source response was too large.');}chunks.push(value);}
 const result=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(result);
}
export function parseRecruiters(html,source,checked){
 if(!html.includes('team_name'))throw Error('Recruiter directory layout changed. Previous people retained.');
 const matches=[...html.matchAll(/class="team_name"[^>]*>([\s\S]*?)<\/div>\s*<div class="team_light"[^>]*>([\s\S]*?)<\/div>/g)];
 const records=matches.map(m=>({name:plainText(m[1]),title:plainText(m[2])})).filter(x=>/recruit/i.test(x.title)&&x.name.length>2);
 if(!records.length)throw Error('No recruiter entries could be verified in the directory.');
 return records.slice(0,30).map(x=>({id:'public-'+source.key+'-'+slug(x.name),type:'recruiter',...x,company:source.name,city:'Location not published',region:'National / unconfirmed',focus:'Data and analytics recruiting',reason:'Published on the firm’s current team directory. The firm specializes in data and analytics recruiting.',caution:'Individual location, recruiting coverage and ownership of a specific vacancy are not published here. Confirm local or remote coverage before outreach.',lastChecked:checked,source:'Official '+source.name+' team directory',url:source.url,feedKey:source.key,verificationState:'listed'}));
}
function normalizeJob(j,source,checked){
 const title=plainText(j.title||j.text),location=plainText(j.location?.name||j.categories?.location||''),url=safeUrl(j.absolute_url||j.hostedUrl);
 if(!title||!url)return null;
 const content=plainText(j.content||j.descriptionPlain||j.description||'');
 const years=content.match(/\b([5-9]|1\d)\+?\s*(?:-|–|to)?\s*\d*\s*years?(?:\s+of)?\s+(?:related\s+|relevant\s+|professional\s+|work\s+)?experience/i);
 const caution=years?`Experience may exceed your entry-level target: the listing mentions ${years[0]}. Review full requirements and June 2027 availability.`:'Title and location match only. Review qualifications, start date and internship graduation requirements for June 2027 eligibility.';
 return {id:`public-${source.key}-${j.id}`,type:'job',title,company:source.name,city:location,state:/\bCA\b|California/i.test(location)?'CA':'',region:region(location),path:'Career preference match',priority:years?'Eligibility mismatch':'Promising',workMode:j.workplaceType||(/remote/i.test(location)?'Remote':/hybrid/i.test(location)?'Hybrid':'See employer listing'),reason:'Found in the employer’s current public job feed and matched to your target role keywords and locations.',caution,lastChecked:checked,source:'Official '+source.name+' job feed',url,feedKey:source.key,verificationState:'listed'};
}
export async function collectCareer(p,fetcher=fetch,now=new Date()){
 const checked=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(now);
 const collected=await Promise.all(CAREER_SOURCES.map(async source=>{
  if((source.kind==='people'&&p.peopleEnabled===false)||(source.kind!=='people'&&p.jobsEnabled===false))return {source:{key:source.key,name:source.name,kind:source.kind==='people'?'people':'jobs',status:'skipped',scanned:0,matches:0,note:'Disabled in your saved preferences.'},jobs:[],recruiters:[],allUrls:[]};
  try{
   const text=await fetchText(source.url,fetcher);
   if(source.kind==='people'){
    const recruiters=parseRecruiters(text,source,checked);
    const related=/analytics|analyst|data|business intelligence/i.test(p.roles+' '+p.connections);
    const include=related&&(p.includeRemote||/national|nationwide|remote|united states/i.test(p.locations+' '+p.connections));
    return {source:{key:source.key,name:source.name,kind:'people',status:'success',scanned:recruiters.length,matches:include?recruiters.length:0,note:include?'National directory; individual location and vacancy ownership unconfirmed.':'National directory omitted by location/specialty preferences.'},jobs:[],recruiters:include?recruiters:[],allUrls:[]};
   }
   const data=JSON.parse(text),rows=source.kind==='greenhouse'?data.jobs:data;
   if(!Array.isArray(rows))throw Error('The employer feed format changed.');
   const allUrls=rows.map(x=>safeUrl(x.absolute_url||x.hostedUrl)).filter(Boolean);
   let candidates=rows.filter(j=>jobMatches(plainText(j.title||j.text),plainText(j.location?.name||j.categories?.location||''),p));
   const entry=j=>/intern|new grad|early career|junior|analyst i\b/i.test(j.title||j.text)?1:0;
   candidates.sort((a,b)=>entry(b)-entry(a)||Number(new Date(b.updated_at||b.createdAt||0))-Number(new Date(a.updated_at||a.createdAt||0)));
   candidates=candidates.slice(0,8);
   let detailFailures=0;
   const jobs=(await Promise.all(candidates.map(async j=>{
    if(source.kind==='greenhouse'&&/^\d+$/.test(String(j.id))){try{const detail=JSON.parse(await fetchText(source.url+'/'+j.id,fetcher));j={...j,...detail};}catch{detailFailures++;}}
    const job=normalizeJob(j,source,checked);
    return job&&jobMatches(job.title,job.city,p)?job:null;
   }))).filter(Boolean);
   return {source:{key:source.key,name:source.name,kind:'jobs',status:detailFailures?'partial':'success',scanned:rows.length,matches:jobs.length,...(detailFailures?{error:`${detailFailures} job descriptions were unavailable; title/location matching only.`}:{})},jobs,recruiters:[],allUrls};
  }catch(error){return {source:{key:source.key,name:source.name,kind:source.kind==='people'?'people':'jobs',status:'failed',scanned:0,matches:0,error:error.name==='TimeoutError'?'Source timed out.':error instanceof SyntaxError?'Source returned an unexpected format.':/^(Source returned HTTP|Source response was|Recruiter directory|No recruiter entries)/.test(error.message)?error.message:'Source could not be reached.'},jobs:[],recruiters:[],allUrls:[]};}
 }));
 return {checked,jobs:collected.flatMap(x=>x.jobs),recruiters:collected.flatMap(x=>x.recruiters),sources:collected.map(x=>x.source),catalogs:collected.filter(x=>['success','partial'].includes(x.source.status)&&x.source.kind==='jobs').map(x=>({key:x.source.key,urls:x.allUrls}))};
}
export function mergeLeads(old,incoming,{direct=false}={}){
 const next={...old},counts={jobsAdded:0,recruitersAdded:0,jobsChecked:incoming.jobs.length,recruitersChecked:incoming.recruiters.length};
 for(const kind of ['jobs','recruiters']){
  const map=new Map();for(const x of old[kind]||[]){const key=leadKey(x,kind);if(!map.has(key))map.set(key,{...x});}
  for(const x of incoming[kind]){
   const key=leadKey(x,kind),prior=map.get(key);
   if(prior){
    if(direct){
     // Refresh provider facts while retaining owner notes and curated assessments.
     const facts=Object.fromEntries(['title','name','company','city','state','region','workMode','url','lastChecked','feedKey'].filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
     if(prior.feedKey&&/^Official /.test(prior.source||''))for(const k of ['reason','caution','priority','focus','path','source'])if(x[k]!==undefined)facts[k]=x[k];
     map.set(key,{...prior,...facts,verificationState:'listed'});
    }else map.set(key,{...prior,...x,id:prior.id});
   }
   else{map.set(key,x);counts[kind+'Added']++;}
  }
  next[kind]=[...map.values()];
 }
 return {next,counts};
}
export function mergeRefresh(old,result,now=new Date().toISOString()){
 const {next,counts}=mergeLeads(old,result,{direct:true});
 for(const job of next.jobs){const catalog=result.catalogs.find(x=>x.key===job.feedKey);if(catalog&&!catalog.urls.some(url=>canonical(url)===canonical(job.url)))job.verificationState='not_listed';}
 const enabled=result.sources.filter(x=>x.status!=='skipped');
 const successes=enabled.filter(x=>x.status!=='failed').length;
 next.lastRefresh={at:now,status:!enabled.length?'disabled':successes===0?'failed':enabled.some(x=>x.status!=='success')?'partial':'completed',...counts,sources:result.sources};
 if(successes)next.lastCurated=result.checked;
 return next;
}
