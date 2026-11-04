import test from 'node:test';
import assert from 'node:assert/strict';
import {localRegion,localEventMatches,pacificDay} from '../public/dashboard/local-regions.mjs';
import {parseEventLinks,parseEventDetail,validateEvent,mergeEvents,collectEvents,parseLocalistEvents,parseCityEvents,saveEvents,EVENT_SOURCES} from '../lib/event-search.mjs';
const now=Date.parse('2026-10-31T03:00:00Z');
const event={name:'Analytics workshop',date:'2026-11-05',time:'5:30 PM',location:'1035 Montecito Drive, Corona, CA 92879',organizer:'Organizer',url:'https://example.test/event/1',summary:'An upcoming local workshop.'};
test('California regions include IE cities and exclude other states and virtual venues',()=>{
 for(const city of ['Redlands, CA','Ontario, CA','Temecula, California','Chino Hills, CA'])assert.equal(localRegion(city),'Inland Empire');
 for(const city of ['Irvine, CA','Anaheim, CA','Orange County, California'])assert.equal(localRegion(city),'Orange County');
 for(const city of ['Orange County, VA','Orange County, NY','Ontario, Canada','Riverside, IL','Virtual / Irvine'])assert.equal(localRegion(city),'');
 assert.equal(pacificDay(now),'2026-10-30');
 assert.equal(localEventMatches(['Past','2026-10-29','','Corona, CA'],{now}),false);
 assert.equal(localEventMatches(['Unknown','','','Corona, CA'],{now,upcoming:false}),true);
});
test('event validation rejects past, impossible, remote, far-future and out-of-area events',()=>{
 assert.ok(validateEvent(event,now));
 for(const patch of [{date:'2026-10-29'},{date:'2026-02-30'},{date:'2027-10-31'},{location:'Orange County, Florida'},{location:'Remote'},{url:'javascript:alert(1)'}])assert.equal(validateEvent({...event,...patch},now),null);
});
test('calendar links are bounded to actual event pages on the source origin',()=>{
 const html='<div class="gz-events-cards"><h5 class="card-title"><a href="https://member.mychamber.org/community-events/Details/workshop-12?sourceTypeId=Website">Workshop</a></h5><h5 class="card-title"><a href="https://attacker.test/events/details/no">Ignore</a></h5></div>';
 const links=parseEventLinks(html,EVENT_SOURCES[3]);assert.equal(links.length,1);assert.equal(links[0].url,'https://member.mychamber.org/community-events/Details/workshop-12');
 assert.throws(()=>parseEventLinks('<html>Oops</html>',EVENT_SOURCES[0]),/format changed/);
});
test('displayed Pacific event date wins over a shifted date-only schema value',()=>{
 const html='<div class="gz-details-titles"><h1>Mixer</h1><h5>Thursday, November 5, 2026 (5:30 PM - 7:30 PM)</h5></div><script type="application/ld+json">'+JSON.stringify({'@type':'Event',startDate:'2026-11-06',location:{name:'Bank',address:{streetAddress:'1035 Montecito Drive',addressLocality:'Corona',addressRegion:'CA'}}})+'</script>';
 const parsed=parseEventDetail(html,{name:event.name,url:event.url},EVENT_SOURCES[2]);assert.equal(parsed.date,'2026-11-05');assert.equal(parsed.time,'5:30 PM - 7:30 PM');assert.equal(localRegion(parsed.location),'Inland Empire');
});
test('nested venue markup includes city; conditional free admission is not marked free',()=>{
 const html='<span itemprop="startDate" content="2026-11-04T19:45:00Z"></span><div class="gz-event-location"><h5>Location</h5><span>Venue</span><p><span>Orange</span><span>CA</span></p></div><div class="gz-event-fees"><h5>Fees</h5><span>Free for Chamber members. Visitors $25.</span></div>';
 const e=parseEventDetail(html,{name:event.name,url:event.url},EVENT_SOURCES[1]);assert.equal(localRegion(e.location),'Orange County');assert.equal(e.free,'Unconfirmed');
});
test('event merge deduplicates URL variants/date and preserves user notes and other data',()=>{
 const first=mergeEvents({holdings:[{ticker:'KO',shares:1,avgCost:2}],quotes:{},briefing:{text:'keep'},sheets:{}},[validateEvent(event,now)],{checkedAt:new Date(now).toISOString()});
 first.sheets['Potential Events'][4][17]='My private plan';const before=structuredClone(first);
 const next=mergeEvents(first,[validateEvent({...event,url:event.url+'?utm_source=mail',summary:'replacement'},now),validateEvent({...event,url:'https://alternate.example/event'},now)],{checkedAt:new Date(now+1000).toISOString()});
 assert.equal(next.sheets['Potential Events'].length,5);assert.equal(next.eventSearch.added,0);assert.equal(next.sheets['Potential Events'][4][17],'My private plan');assert.deepEqual(next.holdings,first.holdings);assert.deepEqual(next.briefing,first.briefing);assert.deepEqual(first,before);
});
test('source failures remain visible without erasing saved events',async()=>{
 const result=await collectEvents({},async()=>new Response('Unavailable',{status:503}),now);
 assert.equal(result.events.length,0);assert.ok(result.sources.every(s=>s.status==='failed'));
 const old=mergeEvents(null,[validateEvent(event,now)],{checkedAt:new Date(now).toISOString()});
 const next=mergeEvents(old,[],result);assert.equal(next.eventSearch.status,'failed');assert.equal(next.sheets['Potential Events'].length,5);
});

test('Corona uses its official alternate calendar when the primary is unavailable',async()=>{
 const calls=[];
 const fetcher=async url=>{
  calls.push(url);
  if(url.startsWith('https://member.mychamber.org/'))return new Response('',{status:403});
  if(url.includes('growthzoneapp.com')){
   if(url.endsWith('/Search'))return new Response('<div class="gz-events-cards"><h5 class="card-title"><a href="https://coronachamberofcommerce.growthzoneapp.com/events/Details/workshop">Workshop</a></h5></div>');
   return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'Event',startDate:'2026-11-05',location:{name:'Venue',address:{addressLocality:'Corona',addressRegion:'CA'}}})+'</script>');
  }
  return Response.json({events:[]});
 };
 const result=await collectEvents({region:'Inland Empire'},fetcher,now);
 assert.equal(result.events.length,1,'Overlapping calendars must still deduplicate');
 assert.ok(result.sources.filter(s=>s.name.startsWith('Corona')).every(s=>s.status==='success'&&s.url.includes('growthzoneapp.com')));
 const rateCalls=[];await collectEvents({region:'Inland Empire'},async url=>{rateCalls.push(url);return new Response('',{status:429});},now);
 assert.ok(!rateCalls.some(u=>u.includes('growthzoneapp.com')),'Do not retry around provider rate limits');
});
test('conditional event saves retry conflicts and leave unrelated concurrent edits intact',async()=>{
 let data={holdings:[],quotes:{},sheets:{}},attempt=0;
 const bucket={get:async()=>({etag:String(attempt),json:async()=>structuredClone(data)}),put:async(_key,value)=>{if(++attempt===1){data.briefing={text:'concurrent briefing'};return null;}data=JSON.parse(value);return {etag:String(attempt)};}};
 const saved=await saveEvents(bucket,[validateEvent(event,now)],{checkedAt:new Date(now).toISOString()});
 assert.equal(attempt,2);assert.equal(saved.briefing.text,'concurrent briefing');assert.equal(saved.sheets['Potential Events'].length,5);
});

test('university feed uses actual venue and instance date and excludes virtual or past events',()=>{
 const source=EVENT_SOURCES.find(x=>x.key==='ucr');
 const e={title:'Community workshop',status:'live',experience:'inperson',location_name:'Research Center',address:'1084 Columbia Ave, Riverside, CA',localist_url:'https://events.ucr.edu/event/workshop',first_date:'2025-01-01',event_instances:[{event_instance:{start:'2026-11-05T12:00:00-08:00',end:'2026-11-05T13:00:00-08:00'}}],ticket_cost:'Free for students; guests $20',free:true};
 const data={events:[{event:e},{event:{...e,experience:'virtual'}},{event:{...e,address:'',location_name:'Unknown venue'}},{event:{...e,event_instances:[{event_instance:{start:'2026-10-01T12:00:00-07:00'}}]}}]};
 const items=parseLocalistEvents(data,source,'workshop',now);assert.equal(items.length,1);assert.equal(items[0].date,'2026-11-05');assert.equal(items[0].free,'Unconfirmed');assert.equal(items[0].region,'Inland Empire');
});

test('city feed requires public local events with matching dates and never infers free admission',()=>{
 const source=EVENT_SOURCES.find(s=>s.key==='corona-city');
 const item={organizationId:34,approvedCommunities:[208],resourceType:'regular',isPrivateEvent:false,closed:false,isExpired:false,timezone:'America/Los_Angeles',name:'Community event',startsAt:'2026-11-05 18:00',startsAtUtc:'2026-11-06T02:00:00Z',endsAtUtc:'2026-11-06T04:00:00Z',locationText:'400 S Vicentia Ave, Corona, CA',resourceUrl:'https://community.coronaca.gov/coronaca_main/123?utm_source=calendar',price:0};
 const data={status:'OK',data:{records:[item,{...item,isPrivateEvent:true},{...item,closed:true},{...item,approvedCommunities:[]},{...item,resourceUrl:'https://other.example/123'},{...item,locationText:'Riverside, IL'},{...item,startsAt:'2026-11-06 18:00'}]}};
 const rows=parseCityEvents(data,source,'community',now);assert.equal(rows.length,1);assert.equal(rows[0].free,'Unconfirmed');assert.equal(rows[0].date,'2026-11-05');assert.equal(rows[0].time,'6:00 PM Pacific');assert.equal(rows[0].url,'https://community.coronaca.gov/coronaca_main/123');
 assert.deepEqual(parseCityEvents(data,source,'unmatched',now),[]);
 const midnight={...item,startsAt:'2026-11-05 00:00',startsAtUtc:'2026-11-05T08:00:00Z'};assert.match(parseCityEvents({status:'OK',data:{records:[midnight]}},source,'',now)[0].time,/unconfirmed/);
 assert.throws(()=>parseCityEvents({status:'NOK'},source,'',now),/format/);
});
