export function pacificTime(value){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'})+' (date only)';
 return value!==null&&value!==undefined&&Number.isFinite(new Date(value).getTime())?new Date(value).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+' PT':'Time unavailable';
}
