import test from 'node:test';
import assert from 'node:assert/strict';
import {jobMatches,parseRecruiters,mergeLeads,mergeRefresh,collectCareer,CAREER_SOURCES} from '../lib/career-refresh.mjs';
import {DEFAULT_RESEARCH_PREFERENCES as prefs} from '../lib/research.mjs';
test('role/location preferences reject unrelated and senior roles, and respect remote choice',()=>{
 assert.ok(jobMatches('Finance Data Analyst Intern','Costa Mesa, CA',prefs));
 assert.ok(jobMatches('Business Analyst','Redlands, CA',prefs));
 assert.ok(!jobMatches('Business Analyst','Orange County, VA',prefs));
 assert.ok(jobMatches('Analyst — August 2027','Newport Beach, CA',prefs));
 assert.ok(!jobMatches('Senior Financial Analyst','Irvine, CA',prefs));
 assert.ok(!jobMatches('Data Engineer','Irvine, CA',prefs));
 assert.ok(!jobMatches('Business Development Representative','Irvine, CA',prefs));
 assert.ok(!jobMatches('Financial Analyst','New York, NY',prefs));
 assert.ok(jobMatches('Financial Analyst','Remote - US',prefs));
 assert.ok(!jobMatches('Financial Analyst','Remote - US',{...prefs,includeRemote:false}));
 assert.ok(!jobMatches('Financial Analyst','Remote - United Kingdom',prefs));
});
test('public directory extracts recruiters only and fails visibly if structure changes',()=>{
 const source=CAREER_SOURCES[3];
 const html='<div class="team_name">Alex Example</div><div class="team_light">Recruiting Manager</div><div class="team_name">Sam Example</div><div class="team_light">Controller</div>';
 const r=parseRecruiters(html,source,'2026-10-28');assert.equal(r.length,1);assert.equal(r[0].name,'Alex Example');assert.equal(r[0].city,'Location not published');assert.equal(r[0].url,source.url);
 assert.throws(()=>parseRecruiters('<p>Page unavailable</p>',source,'2026-10-28'),/layout changed/);
});
test('refresh preserves IDs and researched notes; people sharing a directory remain distinct',()=>{
 const old={jobs:[{id:'saved-id',title:'Analyst',company:'Fender',url:'https://example.com/1',reason:'Personal fit assessment',caution:'Graduation eligibility mismatch',priority:'Eligibility mismatch'}],recruiters:[],lastRefresh:{at:'old'}};
 const incoming={jobs:[{id:'new-id',title:'Analyst I',company:'Fender',url:'https://example.com/1',feedKey:'fender',lastChecked:'2026-10-28',reason:'Generic match',caution:'Generic check'}],recruiters:[{id:'a',name:'Alex Example',company:'BW',url:'https://example.com/team'},{id:'b',name:'Blair Example',company:'BW',url:'https://example.com/team'}]};
 const {next,counts}=mergeLeads(old,incoming,{direct:true});assert.equal(counts.jobsAdded,0);assert.equal(counts.recruitersAdded,2);assert.equal(next.jobs[0].id,'saved-id');assert.equal(next.jobs[0].reason,'Personal fit assessment');assert.equal(next.jobs[0].caution,'Graduation eligibility mismatch');assert.equal(next.jobs[0].title,'Analyst I');
 const retry=mergeLeads(next,incoming,{direct:true});assert.equal(retry.counts.recruitersAdded,0);assert.deepEqual(retry.next.lastRefresh,old.lastRefresh);
 assert.equal(old.jobs[0].title,'Analyst');
});
test('source failure retains saved rows, timestamp and clearly records failure',async()=>{
 const result=await collectCareer(prefs,async()=>new Response('Unavailable',{status:503}));
 assert.equal(result.sources.length,CAREER_SOURCES.length);assert.ok(result.sources.every(x=>x.status==='failed'));
 const old={jobs:[{id:'x',url:'https://example.com',title:'Analyst',feedKey:'fender'}],recruiters:[],lastCurated:'2026-10-27'};
 const next=mergeRefresh(old,result);assert.equal(next.lastRefresh.status,'failed');assert.equal(next.lastCurated,'2026-10-27');assert.equal(next.jobs[0].verificationState,undefined);
 const refreshed=mergeRefresh(old,{jobs:[],recruiters:[],checked:'2026-10-28',catalogs:[{key:'fender',urls:[]}],sources:[{key:'fender',status:'success'}]});assert.equal(refreshed.jobs[0].verificationState,'not_listed');assert.equal(old.jobs[0].verificationState,undefined);
});
test('disabled categories make no provider requests and do not mark saved leads closed',async()=>{
 let calls=0;const result=await collectCareer({...prefs,jobsEnabled:false,peopleEnabled:false},async()=>{calls++;throw Error('Unexpected request');});
 assert.equal(calls,0);assert.equal(result.catalogs.length,0);assert.ok(result.sources.every(s=>s.status==='skipped'));
 const old={jobs:[{id:'keep',url:'https://example.test/job',feedKey:'fender',verificationState:'listed'}],recruiters:[],lastCurated:'2026-10-01'};
 const next=mergeRefresh(old,result);assert.equal(next.lastRefresh.status,'disabled');assert.equal(next.jobs[0].verificationState,'listed');assert.equal(next.lastCurated,old.lastCurated);
});

test('Greenhouse aliases and tracking parameters match an existing curated vacancy',()=>{
 const curated={id:'curated',title:'Analyst',company:'Fender',url:'https://job-boards.greenhouse.io/fender/jobs/8175070',reason:'Personal fit'};
 const feed={id:'feed',title:'Financial Analyst',company:'Fender',url:'https://boards.greenhouse.io/fender/jobs/8175070?gh_jid=8175070',lastChecked:'2026-10-29'};
 const {next,counts}=mergeLeads({jobs:[curated,feed],recruiters:[]},{jobs:[feed],recruiters:[]},{direct:true});
 assert.equal(next.jobs.length,1);assert.equal(next.jobs[0].id,'curated');assert.equal(next.jobs[0].reason,'Personal fit');assert.equal(counts.jobsAdded,0);
});
