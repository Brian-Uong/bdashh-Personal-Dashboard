export const BROWSER_KEYS=Object.freeze([
 'brians-dash-career-board-v1','brians-dash-home-v1',
 'brians-dash-map-locations-v1','brians-dash-skipped-events-v1',
 'brians-dash-motion','brians-dash-radio-v1','brians-dash-fc-trading-v1'
]);
export function collectBrowserPreferences(storage){
 const values={};
 for(const key of BROWSER_KEYS){const value=storage.getItem(key);if(value!==null)values[key]=value;}
 return values;
}
export function validateBrowserBackup(backup){
 if(backup?.format!=='brians-dash-migration'||backup.version!==1||!backup.browserPreferences||typeof backup.browserPreferences!=='object'||Array.isArray(backup.browserPreferences))throw Error('Choose a Brian’s Dash migration backup (version 1).');
 const values={};
 for(const [key,value] of Object.entries(backup.browserPreferences)){
  if(!BROWSER_KEYS.includes(key))throw Error('This backup contains an unsupported browser preference.');
  if(typeof value!=='string'||value.length>2000000)throw Error('Invalid browser preference in backup.');
  if(key!=='brians-dash-motion'){
   let data;try{data=JSON.parse(value);}catch{throw Error('A browser preference contains invalid JSON.');}
   if(!data||typeof data!=='object'||Array.isArray(data))throw Error('A browser preference has an invalid format.');
  }else if(!['on','off','full','reduced'].includes(value))throw Error('Invalid motion preference.');
  values[key]=value;
 }
 return values;
}
