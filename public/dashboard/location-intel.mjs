import {escape as esc} from './networking.mjs';
import {validCoordinates} from './map-data.mjs';
import {distanceMetres} from './commute.mjs';
export const safeWeb=url=>{try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
export function parseCafes(data,origin){
 if(!Array.isArray(data?.elements)||data.remark)throw Error('Coffee search could not complete. Please try again later.');
 const seen=[];
 return data.elements.flatMap(e=>{const p=e.center||e,coordinates=validCoordinates([p.lon,p.lat]),tags=e.tags||{},name=tags.name||tags.brand||'Unnamed café';if(!coordinates||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id))return [];const distance=distanceMetres(origin,coordinates);if(distance>1500||seen.some(x=>x.name===name&&distanceMetres(x.coordinates,coordinates)<35))return [];const item={name,coordinates,distance,url:`https://www.openstreetmap.org/${e.type}/${e.id}`,hours:tags.opening_hours||'',address:[tags['addr:housenumber'],tags['addr:street'],tags['addr:city']].filter(Boolean).join(' '),website:safeWeb(tags.website||tags['contact:website'])};seen.push(item);return [item];}).sort((a,b)=>a.distance-b.distance).slice(0,5);
}
export function photonCafes(data){
 if(!Array.isArray(data?.features))throw Error('Coffee search could not complete. Please try again later.');
 return {elements:data.features.flatMap(feature=>{
  const p=feature?.properties,coordinates=feature?.geometry?.coordinates;
  if(!p||p.osm_key!=='amenity'||p.osm_value!=='cafe'||feature.geometry?.type!=='Point'||!validCoordinates(coordinates))return [];
  const extra=p.extra||{};
  return [{type:({N:'node',W:'way',R:'relation'})[p.osm_type],id:p.osm_id,lon:coordinates[0],lat:coordinates[1],tags:{name:p.name,opening_hours:extra.opening_hours,website:extra.website||extra['contact:website'],'addr:housenumber':p.housenumber,'addr:street':p.street,'addr:city':p.city}}];
 })};
}
const COFFEE_TTL=30*60*1000;
const COFFEE_CACHE_KEY='brians-dash-coffee-v3';
function coffeeStorage(){try{return globalThis.localStorage;}catch{return null;}}
export class CoffeeSearch{
 constructor({fetchImpl=(...args)=>globalThis.fetch(...args),storage=coffeeStorage(),now=Date.now,timeoutMs=18000}={}){
  this.fetchImpl=fetchImpl;this.storage=storage;this.now=now;this.timeoutMs=timeoutMs;this.cache=new Map();this.nextRequest=0;this.busy=false;
  try{const saved=JSON.parse(storage?.getItem(COFFEE_CACHE_KEY)||'[]');if(Array.isArray(saved))for(const [key,value] of saved.slice(-50)){
   const origin=validCoordinates(key.split(',').map(Number));
   if(origin&&Number.isFinite(value.checked)&&this.now()-value.checked>=0&&this.now()-value.checked<COFFEE_TTL){parseCafes(value.data,origin);this.cache.set(key,value);}
  }}catch{/* Ignore invalid or inaccessible browser storage. */}
 }
 async search(origin){
  if(!validCoordinates(origin))throw Error('Place this location on the map first.');
  const key=origin.join(','),cached=this.cache.get(key);
  if(cached&&this.now()-cached.checked<COFFEE_TTL)return {rows:parseCafes(cached.data,origin),checked:cached.checked};
  if(this.busy)throw Error('A coffee search is already running.');
  if(this.now()<this.nextRequest)throw Error('Please wait 30 seconds before another coffee search, or use the Google Maps link.');
  this.busy=true;this.nextRequest=this.now()+1000;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
  try{
   const [lng,lat]=origin;
   const response=await this.fetchImpl('/api/places/nearby?'+new URLSearchParams({lon:lng,lat}),{signal:controller.signal});
   if(!response.ok)throw Error(response.status===429?'The coffee service is busy. Use the Google Maps link, or try again in 30 seconds.':'The coffee service is unavailable. Use the Google Maps link, or try again in 30 seconds.');
   const data=photonCafes(await response.json()),rows=parseCafes(data,origin),checked=this.now();
   this.cache.set(key,{data,checked});
   for(const [k,v] of this.cache)if(checked-v.checked>=COFFEE_TTL)this.cache.delete(k);
   while(this.cache.size>50)this.cache.delete(this.cache.keys().next().value);
   try{this.storage?.setItem(COFFEE_CACHE_KEY,JSON.stringify([...this.cache]));}catch{/* Search still works without storage. */}
   return {rows,checked};
  }catch(e){
   this.nextRequest=this.now()+30000;
   if(controller.signal.aborted)throw Error('The coffee service is not responding. Use the Google Maps link for nearby cafés, or try again in 30 seconds.');
   if(e instanceof TypeError)throw Error('Could not connect to the coffee service. Use the Google Maps link, or try again in 30 seconds.');
   throw e;
  }finally{clearTimeout(timer);this.busy=false;}
 }
}
export function claimValues(entity,property){const claims=(entity.claims?.[property]||[]).filter(c=>c.rank!=='deprecated'&&!c.qualifiers?.P582&&c.mainsnak?.snaktype==='value');const preferred=claims.filter(c=>c.rank==='preferred');return (preferred.length?preferred:claims).map(c=>c.mainsnak.datavalue?.value).filter(v=>v!=null);}
const wiki=params=>'https://www.wikidata.org/w/api.php?'+new URLSearchParams({format:'json',origin:'*',...params});
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(r.status===429?'Service is busy. Please try again later.':'Service unavailable. Please try again later.');const d=await r.json();if(d.error)throw Error('The information service could not complete this request.');return d;}
export class LocationIntel{
 constructor(root){this.root=root;this.coffee=new Map();this.coffeeSearch=new CoffeeSearch();this.profiles=new Map();this.busyCoffee=false;this.busyProfile=false;root.addEventListener('click',e=>{const b=e.target.closest('[data-intel-action]');if(!b)return;const action=b.dataset.intelAction;if(action==='coffee')this.findCoffee();if(action==='company')this.searchCompany();if(action==='entity')this.loadCompany(b.dataset.entity);});}
 key(item=this.item){return item?.coordinates?.join(',')||'';}
 render(item){this.item=item;const host=this.root.querySelector('#geoIntel');if(!host)return;host.innerHTML=this.coffeeMarkup(item)+(item.type==='company'?this.companyMarkup(item):'');}
 coffeeMarkup(item){const state=this.coffee.get(this.key(item)),rows=state?.rows;
 return `<section class="geo-intel"><h4>☕ COFFEE RECON</h4><p>Meet before the event or continue the conversation afterwards.</p><button class="button subtle" data-intel-action="coffee" ${!item.coordinates||this.busyCoffee?'disabled':''}>${state?.loading?'Finding coffee…':rows?'Show nearby coffee':'Find nearby coffee'}</button>${item.coordinates?`<a href="https://www.google.com/maps/search/?${esc(new URLSearchParams({api:'1',query:'cafes near '+item.coordinates[1]+','+item.coordinates[0]}).toString())}" target="_blank" rel="noopener noreferrer">Search cafés on Google Maps ↗</a>`:''}<small>${item.coordinates?'Search within 1.5 km of this office or venue. Only its coordinates are sent to the Photon / Komoot service (OpenStreetMap data).':'Place this location on the map first.'}</small><div role="status">${state?.error?`<p>${esc(state.error)}</p>`:''}${rows?rows.length?`<p class="geo-intel-meta">${rows.length} nearby spots · straight-line distances</p>`+rows.map(c=>`<article><strong>${esc(c.name)}</strong><span>${Math.round(c.distance)} m from ${item.type==='event'?'venue':'office'}</span>${c.address?`<p>${esc(c.address)}</p>`:''}<small>${c.hours?'Listed hours: '+esc(c.hours):'Opening hours not listed'} · Check before visiting</small><div class="geo-intel-links"><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">View place ↗</a><a href="https://www.google.com/maps/dir/?${esc(new URLSearchParams({api:'1',origin:item.coordinates[1]+','+item.coordinates[0],destination:c.coordinates[1]+','+c.coordinates[0],travelmode:'walking'}).toString())}" target="_blank" rel="noopener noreferrer">Walking directions ↗</a>${c.website?`<a href="${esc(c.website)}" target="_blank" rel="noopener noreferrer">Website ↗</a>`:''}</div></article>`).join(''):'<p>No cafés mapped within 1.5 km. Coverage may be incomplete; try Google Maps for more options.</p>':''}</div><small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · Photon / OpenStreetMap${state?.checked?' · Cached for 30 min · Checked '+new Date(state.checked).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</small></section>`;
 }
 companyMarkup(item){const s=this.profiles.get(item.id)||{},p=s.profile;return `<section class="geo-intel"><h4>COMPANY BACKGROUND</h4><p>Headquarters and basic public information. The office pin remains your selected local office.</p><button class="button subtle" data-intel-action="company" ${this.busyProfile?'disabled':''}>${s.loading?'Loading company info…':p?'Choose another match':'Find company info'}</button><small>Searches Wikidata for ${esc(item.company||item.name)}.</small><div role="status">${s.error?`<p>${esc(s.error)}</p>`:''}${s.candidates?'<p>Choose the matching organisation:</p>'+s.candidates.map(c=>`<button class="geo-intel-candidate" data-intel-action="entity" data-entity="${esc(c.id)}" ${this.busyProfile?'disabled':''}><strong>${esc(c.label)}</strong><span>${esc(c.description||'No description available')}</span><small>${esc(c.id)}</small></button>`).join('')+(s.candidates.length?'':'<p>No matches found.</p>'):''}${p?`<article><strong>${esc(p.name)}</strong><p>${esc(p.description||'No description available.')}</p><dl><dt>Headquarters</dt><dd>${esc(p.hq||'Not listed')}</dd><dt>Industry</dt><dd>${esc(p.industry||'Not listed')}</dd><dt>Founded</dt><dd>${esc(p.founded||'Not listed')}</dd></dl>${p.extract?`<p>${esc(p.extract)}</p>`:''}<div class="geo-intel-links">${p.website?`<a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">Official website ↗</a>`:''}<a href="https://www.wikidata.org/wiki/${p.id}" target="_blank" rel="noopener noreferrer">Wikidata source ↗</a>${p.wikipedia?`<a href="${esc(p.wikipedia)}" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>`:''}</div><small>Community-maintained information · may be incomplete.${p.extract?' Excerpt: Wikipedia contributors, CC BY-SA.':''}</small></article>`:''}</div></section>`;}
 async findCoffee(){
  const item=this.item,key=this.key(item);if(!key||this.busyCoffee)return;
  this.busyCoffee=true;this.coffee.set(key,{loading:true});this.render(item);
  try{this.coffee.set(key,await this.coffeeSearch.search(item.coordinates));}
  catch(e){this.coffee.set(key,{error:e.message});}
  finally{this.busyCoffee=false;this.render(this.item);}
 }
 async searchCompany(){const item=this.item;if(item.type!=='company'||this.busyProfile)return;this.busyProfile=true;this.profiles.set(item.id,{loading:true});this.render(item);try{const d=await json(wiki({action:'wbsearchentities',search:item.company||item.name,language:'en',type:'item',limit:'5'}));this.profiles.set(item.id,{candidates:(d.search||[]).filter(c=>/^Q\d+$/.test(c.id))});}catch(e){this.profiles.set(item.id,{error:e.message});}finally{this.busyProfile=false;this.render(this.item);}}
 async loadCompany(id){const item=this.item,state=this.profiles.get(item.id);if(this.busyProfile||!state?.candidates?.some(c=>c.id===id)||!/^Q\d+$/.test(id))return;this.busyProfile=true;this.profiles.set(item.id,{loading:true});this.render(item);try{const d=await json(wiki({action:'wbgetentities',ids:id,props:'labels|descriptions|claims|sitelinks',languages:'en',languagefallback:'1'})),e=d.entities?.[id];if(!e||e.missing!==undefined)throw Error('This company entry is unavailable.');const hq=claimValues(e,'P159').map(v=>v.id).filter(Boolean),industry=claimValues(e,'P452').map(v=>v.id).filter(Boolean),ids=[...new Set([...hq,...industry])].slice(0,30);let labels={};if(ids.length){try{labels=(await json(wiki({action:'wbgetentities',ids:ids.join('|'),props:'labels',languages:'en',languagefallback:'1'}))).entities||{};}catch{}}const title=e.sitelinks?.enwiki?.title,p={id,name:e.labels?.en?.value||item.name,description:e.descriptions?.en?.value||'',hq:hq.map(q=>labels[q]?.labels?.en?.value||q).join(', '),industry:industry.map(q=>labels[q]?.labels?.en?.value||q).join(', '),founded:claimValues(e,'P571')[0]?.time?.match(/^\+?(\d{4})/)?.[1]||'',website:safeWeb(claimValues(e,'P856')[0]),wikipedia:title?'https://en.wikipedia.org/wiki/'+encodeURIComponent(title.replaceAll(' ','_')):''};if(title){try{const summary=await json('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',origin:'*',prop:'extracts',exintro:'1',explaintext:'1',exsentences:'2',redirects:'1',titles:title}));p.extract=Object.values(summary.query?.pages||{})[0]?.extract||'';}catch{}}this.profiles.set(item.id,{profile:p});}catch(e){this.profiles.set(item.id,{error:e.message});}finally{this.busyProfile=false;this.render(this.item);}}
}
