import {records,text,parseDate} from './core.mjs';
import {contact} from './networking.mjs';
export const normal=v=>text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
export const companyKey=v=>normal(v).replace(/(incorporated|corporation|inc|llc)$/,'');
export function validCoordinates(value){if(!Array.isArray(value)||value.length!==2||value.some(v=>v==null||text(v)===''||!Number.isFinite(Number(v))))return null;const [lng,lat]=value.map(Number);return Math.abs(lng)<=180&&Math.abs(lat)<=90?[lng,lat]:null;}
export const officeCatalogue=[];
const venues=[];
const valueByHeader=(headers,cells,names)=>{const i=headers.findIndex(h=>names.includes(text(h).toLowerCase()));return i<0?'':cells[i];};
const coordinatesFrom=(headers,cells)=>validCoordinates([valueByHeader(headers,cells,['longitude','lng','lon']),valueByHeader(headers,cells,['latitude','lat'])]);
export function buildLocations(sheets={},overrides={}){
 const locations=officeCatalogue.map(x=>({...x,contacts:[]}));
 const headers=sheets['Networking Tracker']?.[3]||[];
 for(const row of records(sheets,'Networking Tracker')){
  const c=contact(row,headers),key=companyKey(c.company);if(!key)continue;
  let item=locations.find(x=>companyKey(x.company)===key);
  if(!item){item={id:'company:'+key,type:'company',name:c.company,company:c.company,address:'',coordinates:null,contacts:[],precision:'Needs location',source:'',locationNote:'Choose a public office address. Individual contacts’ workplace at this office is not confirmed.'};locations.push(item);}
  if(!item.coordinates){const coords=coordinatesFrom(headers,row.cells);if(coords){item.coordinates=coords;item.address=text(valueByHeader(headers,row.cells,['office address','address']));item.precision='Workbook coordinates';}}
  item.contacts.push(c);
 }
 for(const row of records(sheets,'Potential Events')){
  const cells=row.cells,address=text(cells[3]),n=normal(address),venue=/\b(online|virtual|remote)\b/i.test(address)?null:venues.find(v=>v.match.some(m=>n.includes(m))||(v.names?.some(m=>n.includes(m))&&n.includes(v.city)));
  const eventHeaders=sheets['Potential Events']?.[3]||[];
  const workbookCoords=/\b(online|virtual|remote)\b/i.test(address)?null:coordinatesFrom(eventHeaders,cells);
  const linkIndex=eventHeaders.findIndex(h=>/^(registration link|event link|event url|registration url|link|url)$/i.test(text(h)));
  const source=linkIndex>=0?text(cells[linkIndex]):cells.map(text).find(v=>/^https:\/\/(luma\.|lu\.ma|www\.eventbrite\.|www\.meetup\.)/i.test(v))||'';
  locations.push({id:'event:'+normal(cells[0])+':'+text(cells[1])+':'+n,type:'event',name:text(cells[0]),date:parseDate(cells[1]),rawDate:text(cells[1]),time:text(cells[2]),address,coordinates:workbookCoords||null,precision:workbookCoords?'Workbook coordinates':'Needs location',status:text(cells[10]),source,contacts:[],row:row.row,locationNote:workbookCoords?'Coordinates supplied in the workbook. Confirm the location before travelling.':'An address is needed before this event can be mapped.'});
 }
 const placeRows=sheets['Saved Places']||[];
 for(let row=1;row<placeRows.length;row++){const c=placeRows[row];if(!text(c[0]))continue;const coords=coordinatesFrom(placeRows[0]||[],c);locations.push({id:'place:'+row,type:'place',name:text(c[0]),company:text(c[0]),address:text(c[1]),coordinates:coords,contacts:[],row,source:text(c[6]),precision:coords?'Saved place coordinates':'Needs location',locationNote:text(c[3])||'Saved place. Confirm the selected address before travelling.'});}
 return locations.map(item=>{const edit=overrides[item.id],coords=validCoordinates(edit?.coordinates);return coords?{...item,coordinates:coords,address:text(edit.address)||item.address,source:text(edit.source)||item.source,precision:'Browser-saved location',locationNote:'Location set in this browser. Confirm the venue or office before travelling.'}:item;});
}
