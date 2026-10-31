export const LOCAL_REGIONS=['Orange County','Inland Empire'];
const oc=/\b(irvine|costa mesa|newport beach|santa ana|tustin|huntington beach|anaheim|fullerton|brea|yorba linda|orange|laguna (?:beach|hills|niguel|woods)|lake forest|mission viejo|san clemente|san juan capistrano|garden grove|westminster|buena park|fountain valley|seal beach|aliso viejo|rancho santa margarita|orange county)\b/i;
const ie=/\b(riverside|corona|norco|redlands|san bernardino|ontario|rancho cucamonga|fontana|chino(?: hills)?|upland|eastvale|jurupa valley|moreno valley|perris|menifee|murrieta|temecula|hemet|beaumont|banning|loma linda|rialto|colton|yucaipa|inland empire)\b/i;
export function localRegion(location){
 const s=String(location||'');
 if(/\b(?:NY|NJ|VA|TX|NC|SC|FL|OH|PA|WA|MA|MD|CT|OR|CO|IL|AZ|NV)\b|new york|virginia|florida|texas|new jersey|canada|united kingdom/i.test(s))return '';
 if(/\bonline\b|\bvirtual\b|\bremote\b/i.test(s))return '';
 return ie.test(s)?'Inland Empire':oc.test(s)?'Orange County':'';
}
export const pacificDay=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function localEventMatches(cells,{region='',upcoming=true,now=Date.now()}={}){
 const day=String(cells?.[1]||'').slice(0,10);
 return (!region||localRegion(cells?.[3])===region)&&(!upcoming||/^\d{4}-\d{2}-\d{2}$/.test(day)&&day>=pacificDay(now));
}
