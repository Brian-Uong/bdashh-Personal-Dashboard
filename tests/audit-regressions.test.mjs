import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLeads,collectCareer} from '../lib/career-refresh.mjs';
import {DEFAULT_RESEARCH_PREFERENCES} from '../lib/research.mjs';
import {updateNews} from '../lib/news.mjs';

test('refresh updates changed employer facts without losing personal notes or fit assessments',()=>{
 const prior={id:'saved',title:'Analyst',company:'Example',city:'Irvine, CA',region:'Orange County',workMode:'On-site',url:'https://example.test/job',notes:'Ask about hours',reason:'Personal assessment',caution:'Check graduation eligibility'};
 const incoming={...prior,id:'feed',title:'Financial Analyst',city:'Redlands, CA',region:'Inland Empire',workMode:'Hybrid',reason:'Generic match',caution:'Generic caution',lastChecked:'2026-10-31',feedKey:'example'};
 const {next}=mergeLeads({jobs:[prior],recruiters:[]},{jobs:[incoming],recruiters:[]},{direct:true});
 assert.equal(next.jobs[0].city,'Redlands, CA');assert.equal(next.jobs[0].workMode,'Hybrid');
 assert.equal(next.jobs[0].id,'saved');assert.equal(next.jobs[0].notes,'Ask about hours');
 assert.equal(next.jobs[0].reason,prior.reason);assert.equal(next.jobs[0].caution,prior.caution);
 assert.equal(prior.city,'Irvine, CA');
});

test('newer job details are rechecked against role and location preferences',async()=>{
 const fetcher=async url=>{
  if(url.endsWith('/fender/jobs'))return Response.json({jobs:[{id:1,title:'Financial Analyst',location:{name:'Irvine, CA'},absolute_url:'https://example.test/job'}]});
  if(url.endsWith('/fender/jobs/1'))return Response.json({id:1,title:'Senior Financial Analyst',location:{name:'New York, NY'},absolute_url:'https://example.test/job'});
  return new Response('',{status:503});
 };
 const result=await collectCareer({...DEFAULT_RESEARCH_PREFERENCES,peopleEnabled:false},fetcher);
 assert.equal(result.jobs.length,0);
 assert.equal(result.sources[0].status,'success');
});

test('a same-day news top-up keeps earlier stories; the next day starts a fresh edition',()=>{
 const now=Date.parse('2026-10-31T17:00:00Z');
 const article=i=>({headline:'Distinct story '+i,summary:'Verified summary.',source:'Example',url:'https://example.test/news/'+i,publishedAt:'2026-10-31'});
 const patch=(items,time)=>({action:'briefings',baseTopicsVersion:0,results:[{topicId:'nba',checkedAt:new Date(time).toISOString(),status:'ready',items}]});
 const first=updateNews(null,patch([0,1,2,3,4].map(article),now),now);
 const topup=updateNews(first,patch([article(5)],now+1000),now+1000);
 assert.equal(topup.briefings.nba.items.length,6);assert.equal(topup.briefings.nba.status,'ready');
 const nextDay=updateNews(topup,patch([article(6)],now+86400000),now+86400000);
 assert.equal(nextDay.briefings.nba.items.length,1);assert.equal(nextDay.briefings.nba.status,'partial');
});
