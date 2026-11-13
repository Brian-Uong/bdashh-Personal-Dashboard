// URL handling is shared by initial loads, tab clicks and browser Back/Forward.
const views=new Set(['overview','investments','news','career','planner','Networking Tracker','Potential Events','Application Tracker']);
export function sectionFromHash(hash='') {
 let key;try{key=decodeURIComponent(String(hash).replace(/^#/,''));}catch{return 'overview';}
 if(key==='mainContent')return null; // Keep the skip-to-content link on this view.
 if(key==='career/applications')return 'Application Tracker';
 if(key==='opportunity-map')return 'Potential Events';
 return views.has(key)?key:'overview';
}
export function sectionHash(key){return key==='Application Tracker'?'#career/applications':'#'+encodeURIComponent(views.has(key)?key:'overview');}
export function writeSectionHistory(history,location,key,{replace=false}={}){
 const hash=sectionHash(key);
 if(location.hash===hash)return;
 history[replace?'replaceState':'pushState'](null,'',hash);
}
