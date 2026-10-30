export const DEFAULT_RESEARCH_PREFERENCES={
 roles:'Business analyst, financial analyst, data analyst, FP&A, analytics consulting',
 locations:'Irvine, Orange County, Riverside, Corona',
 industries:'Finance, automotive and motorsport, healthcare, gaming',
 experience:'Entry-level roles and internships; UCI MSBA graduating June 2027; UCR B.S. Data Science; Python, SQL, Excel, statistical research and healthcare engineering experience.',
 timing:'Summer 2027 internships and graduate roles compatible with June 2027 graduation. Check internship graduation windows and clearly flag full-time roles that need an earlier start.',
 connections:'Recruiters and analytics or finance professionals at relevant employers; UCI/UCR alumni when publicly verifiable.',
 events:'Upcoming local networking, career, analytics and professional community events. Include dates, locations, cost and eligibility when published.',
 exclusions:'Avoid senior, manager or director roles requiring extensive experience. Do not assume eligibility, work authorization, recruiter ownership of a vacancy or current availability.',
 includeRemote:true,jobsEnabled:true,peopleEnabled:true,eventsEnabled:true
};
export function researchState(raw={}){return {preferences:{...DEFAULT_RESEARCH_PREFERENCES,...raw.preferences},revision:raw.revision||0,updatedAt:raw.updatedAt||null,lastRun:raw.lastRun||null};}
export function validatePreferences(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid preferences.');
 const out={};
 for(const [key,def] of Object.entries(DEFAULT_RESEARCH_PREFERENCES)){
  if(typeof def==='boolean'){if(typeof input[key]!=='boolean')throw Error('Invalid research selection.');out[key]=input[key];}
  else{if(typeof input[key]!=='string'||input[key].length>1500)throw Error('Keep each preference under 1,500 characters.');out[key]=input[key].trim();}
 }
 if(!out.roles||!out.locations)throw Error('Enter target roles and locations.');
 return out;
}
export function validateResearchRun(input){
 if(!input||!['completed','partial','failed'].includes(input.status)||!['setup','scheduled'].includes(input.mode))throw Error('Invalid research status.');
 if(!Number.isFinite(Date.parse(input.finishedAt)))throw Error('A research completion time is required.');
 const counts={};for(const key of ['jobs','people','events']){const n=input.counts?.[key];if(!Number.isInteger(n)||n<0||n>100)throw Error('Invalid result count.');counts[key]=n;}
 if(typeof input.summary!=='string'||input.summary.length>2000)throw Error('Invalid research summary.');
 const issues=input.issues||[];if(!Array.isArray(issues)||issues.length>10||issues.some(x=>typeof x!=='string'||x.length>500))throw Error('Invalid research notes.');
 return {status:input.status,mode:input.mode,finishedAt:new Date(input.finishedAt).toISOString(),counts,summary:input.summary.trim(),issues};
}
export function updateResearch(raw,body,now=new Date().toISOString()){
 const old=researchState(raw);
 if(body?.action==='preferences'){
  if(body.baseRevision!==old.revision){const e=Error('Preferences changed elsewhere. Reopen this window before saving.');e.status=409;throw e;}
  return {...old,preferences:validatePreferences(body.preferences),revision:old.revision+1,updatedAt:now};
 }
 if(body?.action==='report'){
  const lastRun=validateResearchRun(body.run);
  if(old.lastRun&&Date.parse(old.lastRun.finishedAt)>Date.parse(lastRun.finishedAt))return old;
  return {...old,lastRun};
 }
 throw Error('Unknown research action.');
}
