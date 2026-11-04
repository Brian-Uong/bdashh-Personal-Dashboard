import {plainText,fetchText} from './career-refresh.mjs';
import {localRegion,pacificDay} from '../public/dashboard/local-regions.mjs';
import {materialize} from './workbook.mjs';
export const EVENT_SOURCES=[
 {key:'irvine',name:'Greater Irvine Chamber',region:'Orange County',url:'https://business.greaterirvinechamber.com/events'},
 {key:'orange',name:'Orange Chamber',region:'Orange County',url:'https://business.orangechamber.com/events/'},
 {key:'corona',name:'Corona Chamber',region:'Inland Empire',url:'https://member.mychamber.org/events',alternateUrl:'https://coronachamberofcommerce.growthzoneapp.com/events/Search'},
 {key:'corona-community',name:'Corona community calendar',region:'Inland Empire',url:'https://member.mychamber.org/community-events',alternateUrl:'https://coronachamberofcommerce.growthzoneapp.com/community-events/Search'},
 {key:'ucr',name:'UC Riverside events',kind:'localist',region:'Inland Empire',url:'https://events.ucr.edu/'},
 {key:'corona-city',name:'City of Corona',kind:'city-calendar',region:'Inland Empire',url:'https://community.coronaca.gov/coronaca_main/calendar'}
];
export const eventUrl=value=>{try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return '';u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_/i.test(k)||['sourceTypeId','fbclid'].includes(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'');}catch{return '';}};
const clean=(value,max=500)=>plainText(value).slice(0,max);
const identity=(name,date,location)=>[name,date,location].map(x=>String(x||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')).join('|');
const attr=(html,key)=>html.match(new RegExp('\\b'+key+'=["\\\']([^"\\\']*)["\\\']','i'))?.[1]||'';
const classBody=(html,name)=>html.match(new RegExp('<(div|span|p)[^>]*class=["\\\'][^"\\\']*\\b'+name+'\\b[^"\\\']*["\\\'][^>]*>([\\s\\S]*?)</\\1>','i'))?.[2]||'';
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function visibleDate(text){const m=text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);return m?`${m[3]}-${String(months.indexOf(m[1].toLowerCase())+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`:'';}
export function parseEventLinks(html,source){
 if(!/gz-events-(?:listing|cards)|gz-events-card/.test(html))throw Error('Calendar format changed.');
 const out=[];
 for(const match of html.matchAll(/<h5[^>]*class=["'][^"']*card-title[^"']*["'][^>]*>([\s\S]*?)<\/h5>/gi)){
  const anchor=match[1].match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);if(!anchor)continue;
  const url=eventUrl(anchor[1].replace(/&amp;/g,'&'));
  if(url&&new URL(url).origin===new URL(source.url).origin&&/\/(?:events|community-events)\/details\//i.test(url)&&!out.some(x=>x.url===url))out.push({url,name:clean(anchor[2],180)});
 }
 return out;
}
export function parseEventDetail(html,link,source){
 let data;
 for(const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const raw=JSON.parse(m[1]),nodes=Array.isArray(raw)?raw:raw['@graph']||[raw];data=nodes.find(x=>x['@type']==='Event')||data;}catch{}
 }
 if(/EventCancelled|EventPostponed/.test(data?.eventStatus||''))return null;
 const startTag=html.match(/<(?:span|meta)[^>]*itemprop=["']startDate["'][^>]*>/i)?.[0]||'';
 const stamp=attr(startTag,'content');
 const visible=clean(classBody(html,'gz-details-titles'),1500);
 const date=visibleDate(visible)||(stamp&&Number.isFinite(Date.parse(stamp))?pacificDay(stamp):'')||data?.startDate?.slice(0,10)||'';
 const locHtml=classBody(html,'gz-event-location');
 const address=data?.location?.address;
 const location=locHtml?clean(locHtml.replace(/<h5[\s\S]*?<\/h5>/i,''),500):clean([data?.location?.name,address?.streetAddress,address?.addressLocality,address?.addressRegion,address?.postalCode].filter(Boolean).join(', '),500);
 const time=clean(classBody(html,'gz-details-time'),100)||visible.match(/\((\d{1,2}:\d{2}\s*[AP]M[^)]*)\)/i)?.[1]||'Time unconfirmed';
 const fees=clean(classBody(html,'gz-event-fees').replace(/<h5[\s\S]*?<\/h5>/i,''),300)||'Not published — check organizer';
 return {name:link.name,date,time,location,organizer:source.name,url:link.url,source:source.name,cost:fees,free:/members? only|for (?:chamber )?members|visitors?|guests?|eligib/i.test(fees)?'Unconfirmed':/^(?:free|no charge|\$0)(?:\s|$)/i.test(fees)?'Yes':/\$\d/.test(fees)?'No':'Unconfirmed',category:'Local community & networking',summary:'Listed on the organizer’s current calendar. Review the event page for its agenda, admission and registration requirements.',eligibility:'Check organizer requirements; membership or advance registration may be needed.'};
}
export function validateEvent(item,now=Date.now()){
 const date=String(item?.date||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<pacificDay(now)||date>pacificDay(now+90*86400000))return null;
 const region=localRegion(item.location),url=eventUrl(item.url);
 if(!region||!url||!clean(item.name,180)||!clean(item.organizer||item.source,150))return null;
 return {name:clean(item.name,180),date,time:clean(item.time,100)||'Time unconfirmed',location:clean(item.location,500),region,url,organizer:clean(item.organizer||item.source,150),source:clean(item.source||item.organizer,150),category:clean(item.category,100)||'Local event',summary:clean(item.summary||item.reason,600)||'See the organizer’s event page for details.',benefit:clean(item.benefit,500),cost:clean(item.cost,300)||'Not published — check organizer',free:['Yes','No'].includes(item.free)?item.free:'Unconfirmed',eligibility:clean(item.eligibility,300)||'Not published — check organizer'};
}
export function parseLocalistEvents(data,source,query='',now=Date.now()){
 if(!Array.isArray(data.events))throw Error('Calendar format changed.');
 const time=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit'}).format(new Date(value));
 return data.events.flatMap(({event:e})=>{
  if(!e||e.status!=='live'||e.private||e.rejected||e.experience==='virtual')return [];
  if(query&&!clean(e.title+' '+(e.description_text||''),10000).toLowerCase().includes(query.toLowerCase()))return [];
  const url=eventUrl(e.localist_url);if(!url||new URL(url).origin!==new URL(source.url).origin)return [];
  // Only use the event's own published address/geo, never the university footer.
  const address=clean(e.address,400),hasCity=!!localRegion(address);
  const location=[address.toLowerCase().includes(String(e.location_name||'').toLowerCase())?'':e.location_name,e.room_number?'Room '+e.room_number:'',address,...(hasCity?[]:[e.geo?.street,e.geo?.city,e.geo?.state,e.geo?.zip])].filter(Boolean).join(', ');
  const instance=(e.event_instances||[]).map(x=>x.event_instance).find(x=>x&&Number.isFinite(Date.parse(x.start))&&(x.all_day?pacificDay(x.start)>=pacificDay(now):Date.parse(x.end||x.start)>=now));
  if(!instance)return [];
  const cost=clean(e.ticket_cost,300)||'Not published — check organizer';
  const conditional=/students?|members?|alumni|visitors?|guests?|eligible|eligibility/i.test(cost);
  const item=validateEvent({name:e.title,date:pacificDay(instance.start),time:instance.all_day?'All day':time(instance.start)+(instance.end?'–'+time(instance.end):'')+' Pacific',location,url,organizer:source.name,source:source.name,cost,free:conditional?'Unconfirmed':e.free===true?'Yes':/\$[1-9]/.test(cost)?'No':'Unconfirmed',category:clean((e.filters?.event_types||[]).map(x=>x.name).join(', '),100),summary:'Published on UC Riverside’s official events calendar. Follow the event page for its agenda, admission and registration details.',eligibility:clean((e.filters?.event_audience||[]).map(x=>x.name).join(', '),200)||'Audience and admission requirements: check organizer.'},now);
  return item?[item]:[];
 });
}
async function collectLocalist(source,query,fetcher,now){
 const pages=await Promise.all([1,2].map(async page=>{
  try{const url=new URL('/api/2/events',source.url);url.search=new URLSearchParams({pp:'100',days:'90',start:pacificDay(now),page:String(page),distinct:'true',experience:'inperson'}).toString();const data=JSON.parse(await fetchText(url.href,fetcher));return {items:parseLocalistEvents(data,source,query,now),scanned:data.events.length};}
  catch{return {items:[],scanned:0,failed:true};}
 }));
 const seen=new Set(),items=pages.flatMap(x=>x.items).filter(e=>{const key=e.url+'|'+e.date;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
 const failed=pages.filter(p=>p.failed).length;
 return {items,source:{name:source.name,url:source.url,status:failed===2?'failed':failed?'partial':'success',scanned:pages.reduce((n,p)=>n+p.scanned,0),matches:items.length,note:'Up to 200 calendar entries checked; up to 8 verified local events saved. Entries without a published local venue are omitted. Check each event’s audience restrictions.'}};
}
export function parseCityEvents(payload,source,query='',now=Date.now()){
 const data=payload?.data;
 if(payload?.status!=='OK'||!Array.isArray(data?.records))throw Error('City calendar format changed.');
 const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit'});
 return data.records.flatMap(e=>{
  if(e.organizationId!==34||!e.approvedCommunities?.includes(208)||e.resourceType!=='regular'||e.isPrivateEvent!==false||e.closed||e.isExpired||e.timezone!=='America/Los_Angeles')return [];
  if(query&&!clean(e.name+' '+(e.plainDescription||''),12000).toLowerCase().includes(query.toLowerCase()))return [];
  const url=eventUrl(e.resourceUrl),start=Date.parse(e.startsAtUtc),end=Date.parse(e.endsAtUtc),date=String(e.startsAt||'').slice(0,10);
  if(!url||new URL(url).origin!==new URL(source.url).origin||!/^\/coronaca_[a-z_]+\/\d+$/.test(new URL(url).pathname)||!Number.isFinite(start)||pacificDay(start)!==date||(Number.isFinite(end)?end:start)<now)return [];
  const item=validateEvent({name:e.name,date,time:e.isAllDay?'All day':/ 00:00$/.test(e.startsAt)?'Time unconfirmed — check event page':time.format(start)+' Pacific',location:e.locationText||e.location,url,organizer:source.name,source:source.name,category:'City events & community',summary:'Published on the City of Corona’s official calendar. Open the event page for the agenda, current registration and participation requirements.',cost:'Check event page for admission and activity fees',free:'Unconfirmed',eligibility:'Check event page for registration, age and participation requirements.'},now);
  return item?[item]:[];
 });
}
async function collectCityEvents(source,query,fetcher,now){
 try{
  // Public endpoint used by the calendar iframe linked from coronaca.gov.
  // It requires no token; no private/available-resources endpoint is queried.
  const params=new URLSearchParams({pageSize:'50',page:'1','filterBy[startsAt]':String(Math.floor(Date.parse(pacificDay(now)+'T00:00:00Z')/1000)),'filterBy[endsAt]':String(Math.floor((now+90*86400000)/1000)),'filterBy[onlyDated]':'true','filterBy[includeSpanning]':'true'});
  const data=JSON.parse(await fetchText('https://api.withapps.io/api/v2/organizations/34/communities/208/resources/published?'+params,fetcher));
  const items=parseCityEvents(data,source,query,now).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  return {items,source:{name:source.name,url:source.url,status:'success',scanned:data.data.records.length,matches:items.length,note:'Up to 50 public calendar entries checked; up to 8 local events saved. Missing times and fees remain unconfirmed.'}};
 }catch{return {items:[],source:{name:source.name,url:source.url,status:'failed',scanned:0,matches:0,note:'City calendar unavailable. Existing events retained.'}};}
}
export async function collectEvents({region='',query=''}={},fetcher=fetch,now=Date.now()){
 const sources=EVENT_SOURCES.filter(s=>!region||s.region===region);
 const results=await Promise.all(sources.map(async source=>{
  if(source.kind==='localist')return collectLocalist(source,query,fetcher,now);
  if(source.kind==='city-calendar')return collectCityEvents(source,query,fetcher,now);
  try{
   let calendar=source,html;
   try{html=await fetchText(source.url,fetcher);}
   catch(error){
    // The organizer also publishes this calendar at its native GrowthZone host.
    // One fixed alternative only; do not retry a rate-limited endpoint.
    if(!source.alternateUrl||/HTTP 429/.test(error.message))throw error;
    calendar={...source,url:source.alternateUrl};html=await fetchText(calendar.url,fetcher);
   }
   const links=parseEventLinks(html,calendar).filter(x=>!query||x.name.toLowerCase().includes(query.toLowerCase())).slice(0,6);
   let failed=0,rejected=0;const items=[];
   // Two detail requests per source at a time, at most 24 across the run.
   for(let i=0;i<links.length;i+=2)await Promise.all(links.slice(i,i+2).map(async link=>{try{const raw=parseEventDetail(await fetchText(link.url,fetcher),link,source),item=raw&&validateEvent(raw,now);if(item&&(!region||item.region===region))items.push(item);else rejected++;}catch{failed++;}}));
   return {items,source:{name:source.name,url:calendar.url,status:failed?'partial':'success',scanned:links.length,matches:items.length,note:`${calendar!==source?'Using the organizer’s public GrowthZone calendar. ':''}${rejected} outside the date/location criteria; ${failed} detail pages unavailable. Up to 6 listings checked.`}};
  }catch(error){return {items:[],source:{name:source.name,url:source.url,status:'failed',scanned:0,matches:0,note:(/^Source returned HTTP|Calendar format changed/.test(error.message)?error.message:'Source unavailable.')+' Existing events retained.'}};}
 }));
 const seen=new Set(),identities=new Set(),events=results.flatMap(r=>r.items).filter(e=>{const k=e.url+'|'+e.date,id=identity(e.name,e.date,e.location);if(seen.has(k)||identities.has(id))return false;seen.add(k);identities.add(id);return true;}).sort((a,b)=>a.date.localeCompare(b.date));
 return {events,sources:results.map(r=>r.source),query,region,checkedAt:new Date(now).toISOString()};
}
export function mergeEvents(saved,items,{checkedAt=new Date().toISOString(),sources=[],mode='sources',query='',region=''}={}){
 const next=materialize(structuredClone(saved||{holdings:[],quotes:{},sheets:{}})),rows=next.sheets['Potential Events'],headers=rows[3];
 const at=name=>headers.indexOf(name),key=(url,date)=>eventUrl(url)+'|'+date;
 const keys=new Set(rows.slice(4).map(row=>key(row[at('Registration Link')],row[at('Date')])));const identities=new Set(rows.slice(4).map(row=>identity(row[at('Event')],row[at('Date')],row[at('Location')])));let added=0;
 for(const event of items){
  const k=key(event.url,event.date),id=identity(event.name,event.date,event.location);if(keys.has(k)||identities.has(id))continue;
  const values={'Event':event.name,'Date':event.date,'Time':event.time,'Location':event.location,'Organiser':event.organizer,'Category':event.category,'Registration Link':event.url,'Free':event.free,'Cost':event.cost,'Status':'Suggested','Source Notes':`${event.source} · checked ${pacificDay(checkedAt)} · ${event.url}`,'Eligibility':event.eligibility,'Checked':pacificDay(checkedAt),'Event Summary':event.summary,'How it helps you':event.benefit,'Format':'In person'};
  rows.push(headers.map(h=>values[h]||''));keys.add(k);identities.add(id);added++;
 }
 const succeeded=sources.filter(s=>s.status!=='failed');
 next.eventSearch={at:checkedAt,mode,status:sources.length&&!succeeded.length?'failed':sources.some(s=>!['success','verified'].includes(s.status))?'partial':'completed',added,matched:items.length,query,region,sources};
 next.updatedAt=new Date().toISOString();return next;
}
export async function saveEvents(bucket,items,meta){
 for(let i=0;i<3;i++){
  const obj=await bucket.get('dashboard.json'),state=obj?await obj.json():null;
  if(state?.eventSearch?.at&&Date.parse(state.eventSearch.at)>Date.parse(meta.checkedAt))return state;
  const next=mergeEvents(state,items,meta);
  if(await bucket.put('dashboard.json',JSON.stringify(next),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}}))return next;
 }
 throw Object.assign(Error('Events changed during save. Reload saved events before retrying.'),{status:409});
}
